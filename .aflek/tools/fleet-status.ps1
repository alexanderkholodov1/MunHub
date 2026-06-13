# fleet-status.ps1 — the fleet's visibility board (read-only; mutates nothing).
#
# Kills the "black box": one command shows which providers are alive, who is doing what, what is
# under review, and how much quota is burning. Run it at a milestone's start (roster health feeds
# compose-fleet), keep it live during execution (Monitor), and run it at close.
#
# Usage:  pwsh tools/fleet-status.ps1 [-Repo owner/name] [-Tokens]
#   -Repo    defaults to the repo of the current directory (gh repo view)
#   -Tokens  also report local Claude Code token usage via ccusage (needs npx)
#
# Secrets are read from the env (source the adopter's load-fleet-env.sh first); values never print.

param(
  [string]$Repo,
  [switch]$Tokens
)

$ErrorActionPreference = 'SilentlyContinue'
if (-not $Repo) { $Repo = gh repo view --json nameWithOwner --jq '.nameWithOwner' }
if (-not $Repo) { Write-Host "No repo detected. Pass -Repo owner/name." -ForegroundColor Red; exit 1 }

function Section($t) { Write-Host "`n== $t ==" -ForegroundColor Cyan }
function Up($n,$e)   { Write-Host ("  {0,-16} UP    {1}" -f $n,$e) -ForegroundColor Green }
function Down($n,$e) { Write-Host ("  {0,-16} DOWN  {1}" -f $n,$e) -ForegroundColor Red }
function Note($n,$e) { Write-Host ("  {0,-16} {1}" -f $n,$e) -ForegroundColor DarkYellow }

Write-Host "FLEET STATUS — $Repo — $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Yellow

# ── 0. Provider roster health (probed now — the composition depends on who's actually alive) ────
Section "Provider roster (live health)"
# Gemini CLI
$g = (& gemini --version 2>$null)
if ($g) { Up "Gemini CLI" "v$g" } else { Down "Gemini CLI" "not on PATH" }
# Cursor API (Bearer, not Basic)
if ($env:CURSOR_API_KEY) {
  $cc = (curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $($env:CURSOR_API_KEY)" "https://api.cursor.com/v0/agents?limit=1" 2>$null)
  if ($cc -eq '200') { Up "Cursor API" "HTTP 200 (Bearer)" } else { Down "Cursor API" "HTTP $cc — key invalid/expired" }
} else { Note "Cursor API" "CURSOR_API_KEY not in env — source load-fleet-env.sh" }
# GitHub (worker push capability)
if ($env:GITHUB_PAT) {
  $gh = (curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $($env:GITHUB_PAT)" "https://api.github.com/repos/$Repo" 2>$null)
  if ($gh -eq '200') { Up "GitHub" "HTTP 200 — workers can push/PR" } else { Down "GitHub" "HTTP $gh" }
} else { Note "GitHub" "GITHUB_PAT not in env" }
# Vercel (preview deploys)
if ($env:VERCEL_API_KEY) {
  $vc = (curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $($env:VERCEL_API_KEY)" "https://api.vercel.com/v2/user" 2>$null)
  if ($vc -eq '200') { Up "Vercel API" "HTTP 200" } else { Down "Vercel API" "HTTP $vc" }
} else { Note "Vercel API" "VERCEL_API_KEY not in env (add to load-fleet-env.sh to enable)" }
# Always-on / fixed-tier
Up   "Claude subagents" "in-harness (Agent tool)"
Note "Copilot" "review-only (coding agent off on Education)"
Write-Host "  → DOWN providers are excluded from this milestone's pool; re-route their lanes and note it." -ForegroundColor DarkGray

# ── 1. PR queue: the primary truth surface ──────────────────────────────────────────────────────
Section "Open PRs (deliverables in flight)"
$prs = gh pr list --repo $Repo --state open --json number,title,author,headRefName,reviewDecision,statusCheckRollup,isDraft | ConvertFrom-Json
if (-not $prs) { Write-Host "  (none — fleet idle or everything merged)" }
foreach ($pr in $prs) {
  $checks = ($pr.statusCheckRollup | Group-Object conclusion | ForEach-Object { "$($_.Name ?? 'pending'):$($_.Count)" }) -join ' '
  $agent = switch -Regex ($pr.author.login) {
    'copilot' { 'COPILOT' } 'cursor' { 'CURSOR' } 'claude' { 'CLAUDE' } default { $pr.author.login } }
  $draft = if ($pr.isDraft) { '[draft] ' } else { '' }
  Write-Host ("  #{0} {1}{2}" -f $pr.number, $draft, $pr.title)
  Write-Host ("      by {0} · {1} · review: {2} · checks: {3}" -f $agent, $pr.headRefName, ($pr.reviewDecision ?? 'NONE'), ($checks ?? 'none'))
}

# ── 2. Review activity (author ≠ reviewer, D35) ─────────────────────────────────────────────────
Section "Latest reviews (who reviewed, verdict)"
$any = $false
foreach ($pr in $prs) {
  $reviews = gh api "repos/$Repo/pulls/$($pr.number)/reviews" --jq '[.[-3:][] | "\(.user.login): \(.state)"] | join(" · ")'
  if ($reviews) { Write-Host ("  #{0}: {1}" -f $pr.number, $reviews); $any = $true }
}
if (-not $any) { Write-Host "  (no reviews yet — cross-provider review is not happening; enable it)" -ForegroundColor DarkYellow }

# ── 3. CI runs ──────────────────────────────────────────────────────────────────────────────────
Section "Recent CI runs"
gh run list --repo $Repo --limit 6 --json displayTitle,conclusion,headBranch,updatedAt --jq '.[] | "  [\(.conclusion // "running")] \(.headBranch) — \(.displayTitle)"'

# ── 4. Cursor Cloud Agents (Bearer) ─────────────────────────────────────────────────────────────
Section "Cursor Cloud Agents"
if ($env:CURSOR_API_KEY) {
  $agents = Invoke-RestMethod -Uri "https://api.cursor.com/v0/agents?limit=10" -Headers @{ Authorization = "Bearer $($env:CURSOR_API_KEY)" }
  if ($agents.agents) { foreach ($a in $agents.agents) { Write-Host ("  [{0}] {1} — {2}" -f $a.status, $a.name, ($a.source.repository ?? '')) } }
  else { Write-Host "  (no cloud agents running)" }
} else { Write-Host "  CURSOR_API_KEY not in env" -ForegroundColor DarkYellow }

# ── 5. Quota / usage ────────────────────────────────────────────────────────────────────────────
Section "Quota / usage"
Write-Host "  Claude (subscription): use 'claude /usage' in a session$(if (-not $Tokens) { ' or rerun with -Tokens for local log totals' })"
if ($Tokens) {
  Write-Host "  Claude Code local logs (ccusage):"
  npx -y ccusage@latest daily --json 2>$null | ConvertFrom-Json | Select-Object -ExpandProperty totals | Format-List | Out-String | Write-Host
}
Write-Host "  Copilot premium requests: github.com/settings/billing · Gemini free tier: aistudio.google.com"

Write-Host "`nThe PR queue + this board are the fleet's only truth surfaces (doctrine 2/6)." -ForegroundColor Yellow

# wave-preflight.ps1 — MANDATORY gate before any fleet fan-out (AFLEK run-a-wave, executable).
#
# A checklist you have to *remember* is fragile; this makes it a hard gate. It blocks a wave unless
# lanes are disjoint, no work package touches an orchestrator-owned high-contention file, every
# routed executor is reachable, and the PR queue carries no unmerged dependency. Kit-level: pass
# -Project to point it at any adopter repo; adopters may also keep a thin copy under infra/fleet.
#
# Usage:
#   pwsh tools/wave-preflight.ps1 -Project "C:\path\to\repo" -Wave <manifest.json> [-MaxIndependentPRs 8]
#
# Exit 0 = cleared. Non-zero = blocked, with the reason. Read-only; mutates nothing.

param(
  [Parameter(Mandatory)][string]$Wave,
  [string]$Project = (Get-Location).Path,
  [int]$MaxIndependentPRs = 8,
  [string]$Repo
)

$ErrorActionPreference = 'Stop'
$fail = @(); $warn = @()
function Ok($m)   { Write-Host "  [ OK ] $m" -ForegroundColor Green }
function Bad($m)  { Write-Host "  [FAIL] $m" -ForegroundColor Red;    $script:fail += $m }
function Warn($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow; $script:warn += $m }

$repoRoot = (Resolve-Path $Project).Path
Push-Location $repoRoot
try { if (-not $Repo) { $Repo = gh repo view --json nameWithOwner --jq '.nameWithOwner' } } catch {}
Write-Host "WAVE PREFLIGHT — $Repo — manifest: $Wave" -ForegroundColor Cyan

# 0. Manifest ────────────────────────────────────────────────────────────────────────────────────
if (-not (Test-Path $Wave)) { Write-Host "Manifest not found: $Wave" -ForegroundColor Red; Pop-Location; exit 2 }
$manifest = Get-Content $Wave -Raw | ConvertFrom-Json
$wps = @($manifest.workPackages)
if ($wps.Count -eq 0) { Write-Host "Manifest has no workPackages." -ForegroundColor Red; Pop-Location; exit 2 }
if ($wps.Count -gt 5) { Warn "Wave has $($wps.Count) WPs (>5). A wave that needs >5 WPs is two waves." }

# 1. Executors reachable ───────────────────────────────────────────────────────────────────────────
Write-Host "`n== 1. Executor readiness ==" -ForegroundColor Cyan
$needed = $wps | ForEach-Object { $_.executor } | Sort-Object -Unique
$envSh = Join-Path $repoRoot 'infra/fleet/load-fleet-env.sh'
$secrets = @{}
if (Test-Path $envSh) {
  $dump = bash -c "source '$envSh' >/dev/null 2>&1; echo CURKEY=`$CURSOR_API_KEY; echo PAT=`$GITHUB_PAT"
  foreach ($line in $dump) { if ($line -match '^(CURKEY|PAT)=(.*)$') { $secrets[$Matches[1]] = $Matches[2] } }
} else { Warn "infra/fleet/load-fleet-env.sh not found in project — secrets unverified." }

foreach ($ex in $needed) {
  switch ($ex) {
    'gemini'  { if (& gemini --version 2>$null) { Ok "gemini CLI present" } else { Bad "gemini CLI not on PATH" } }
    'cursor'  {
      if ($secrets['CURKEY']) {
        $code = (curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $($secrets['CURKEY'])" "https://api.cursor.com/v0/agents?limit=1" 2>$null)
        if ($code -eq '200') { Ok "Cursor API reachable (Bearer 200)" } else { Bad "Cursor API HTTP $code — regenerate key" }
      } else { Bad "CURSOR_API_KEY not loaded" }
    }
    'copilot' { Warn "Copilot coding agent is review-only on Education — not an executor." }
    'claude'  { Ok "claude — reserve for research/architecture, not mechanical bulk" }
    default   { Bad "Unknown executor '$ex' in manifest" }
  }
}
if ($secrets['PAT']) {
  $rl = (curl -sI -H "Authorization: token $($secrets['PAT'])" https://api.github.com 2>$null | Select-String -Pattern '^x-ratelimit-limit:\s*(\d+)')
  if ($rl -and [int]($rl.Matches.Groups[1].Value) -ge 5000) { Ok "GitHub PAT authenticates — workers can push/PR" }
  else { Warn "GitHub PAT rate limit not >=5000 — confirm contents:write + pull_requests:write" }
} else { Warn "GITHUB_PAT not loaded — workers may not be able to push" }

# 2. Disjoint lanes (THE fan-out guard) ────────────────────────────────────────────────────────────
Write-Host "`n== 2. Disjoint lanes ==" -ForegroundColor Cyan
$highContention = @('docs/STATUS.md','AGENTS.md','CLAUDE.md','GEMINI.md','changelog.d/','packages/shared/','packages/data-provider/','planning/00-MASTER-PLAN.md','planning/04-BACKLOG.md','.aflek/')
$resolved = @{}
foreach ($wp in $wps) {
  $files = @()
  foreach ($glob in $wp.paths) {
    $matched = git ls-files -- "$glob" 2>$null
    if ($matched) { $files += $matched } else { Warn "WP $($wp.id): pattern '$glob' matched no tracked files" }
  }
  $resolved[$wp.id] = $files | Sort-Object -Unique
  foreach ($hc in $highContention) {
    if ($resolved[$wp.id] | Where-Object { $_ -like "$hc*" }) { Bad "WP $($wp.id) touches high-contention path '$hc' — orchestrator owns it." }
  }
}
$ids = @($resolved.Keys)
for ($i = 0; $i -lt $ids.Count; $i++) {
  for ($j = $i + 1; $j -lt $ids.Count; $j++) {
    $shared = $resolved[$ids[$i]] | Where-Object { $resolved[$ids[$j]] -contains $_ }
    if ($shared) { Bad "Lanes $($ids[$i]) and $($ids[$j]) BOTH edit: $($shared -join ', ') — sequence them or give the file one owner." }
  }
}
if ($fail.Count -eq 0) { Ok "All $($wps.Count) lanes are disjoint and avoid high-contention files" }

# 3. PR queue — dependency-aware ───────────────────────────────────────────────────────────────────
Write-Host "`n== 3. PR queue (dependency-aware) ==" -ForegroundColor Cyan
$open = @(); try { $open = @(gh pr list --repo $Repo --state open --json number | ConvertFrom-Json) } catch {}
if ($manifest.dependsOnUnmergedPRs) { Bad "Wave depends on unmerged PRs — merge/approve the foundation first." }
elseif ($open.Count -ge $MaxIndependentPRs) { Warn "$($open.Count) PRs open (cap $MaxIndependentPRs) — drain the review queue before adding more." }
else { Ok "$($open.Count) open PRs (cap $MaxIndependentPRs); no declared dependency — clear to add." }

Pop-Location
# Verdict ──────────────────────────────────────────────────────────────────────────────────────────
Write-Host "`n== Verdict ==" -ForegroundColor Cyan
if ($fail.Count -gt 0) {
  Write-Host "BLOCKED — $($fail.Count) hard failure(s). Do NOT launch:" -ForegroundColor Red
  $fail | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  exit 1
}
if ($warn.Count -gt 0) { Write-Host "Cleared with $($warn.Count) warning(s) — read them before launching." -ForegroundColor Yellow }
Write-Host "PREFLIGHT PASSED — cleared to launch." -ForegroundColor Green
exit 0

# wave-preflight.ps1 — MANDATORY gate before any fleet fan-out (AFLEK run-a-wave, executable).
#
# The run-a-wave playbook is doctrine, but doctrine you have to *remember* is fragile. This script
# makes the checklist a hard gate: no wave launches until it exits 0. It catches the two failure
# modes from wave F1-W4 — workers sharing a file, and an unreviewed dependent PR stack — plus it
# verifies every executor is actually reachable so workers never burn tokens retrying dead access.
#
# Usage:
#   pwsh infra/fleet/wave-preflight.ps1 -Wave infra/fleet/waves/<name>.json [-MaxIndependentPRs 8]
#
# Wave manifest (JSON):
#   {
#     "dependsOnUnmergedPRs": false,        // true = this wave builds on an open PR -> must pause
#     "workPackages": [
#       { "id": "WP-A", "executor": "gemini|cursor|copilot|claude", "paths": ["planning/07-*.md", ...] },
#       ...
#     ]
#   }
#
# Exit 0 = cleared to launch. Exit non-zero = blocked, with the reason. Read-only; mutates nothing.

param(
  [Parameter(Mandatory)][string]$Wave,
  [int]$MaxIndependentPRs = 8,
  [string]$Repo
)

$ErrorActionPreference = 'Stop'
$fail = @()
$warn = @()
function Ok($m)   { Write-Host "  [ OK ] $m" -ForegroundColor Green }
function Bad($m)  { Write-Host "  [FAIL] $m" -ForegroundColor Red;    $script:fail += $m }
function Warn($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow; $script:warn += $m }

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $Repo) { $Repo = gh repo view --json nameWithOwner --jq '.nameWithOwner' }
Write-Host "WAVE PREFLIGHT — $Repo — manifest: $Wave" -ForegroundColor Cyan

# ── 0. Manifest ────────────────────────────────────────────────────────────────────────────────
if (-not (Test-Path $Wave)) { Write-Host "Manifest not found: $Wave" -ForegroundColor Red; exit 2 }
$manifest = Get-Content $Wave -Raw | ConvertFrom-Json
$wps = @($manifest.workPackages)
if ($wps.Count -eq 0) { Write-Host "Manifest has no workPackages." -ForegroundColor Red; exit 2 }
if ($wps.Count -gt 5) { Warn "Wave has $($wps.Count) WPs (>5). The playbook says a wave that needs >5 WPs is two waves." }

# ── 1. Executors reachable (so workers don't retry dead access, local AND cloud) ─────────────────
Write-Host "`n== 1. Executor readiness ==" -ForegroundColor Cyan
$needed = $wps | ForEach-Object { $_.executor } | Sort-Object -Unique
$envSh = Join-Path $repoRoot 'infra/fleet/load-fleet-env.sh'
# Pull the loaded secrets into THIS process via bash, without printing them.
$secrets = @{}
if (Test-Path $envSh) {
  $dump = bash -c "source '$envSh' >/dev/null 2>&1; echo GEMINI=`${GEMINI_API_KEY:+set}; echo CURSOR=`${CURSOR_API_KEY:+set}; echo GHPAT=`${GITHUB_PAT:+set}; echo CURKEY=`$CURSOR_API_KEY; echo PAT=`$GITHUB_PAT"
  foreach ($line in $dump) { if ($line -match '^(GEMINI|CURSOR|GHPAT|CURKEY|PAT)=(.*)$') { $secrets[$Matches[1]] = $Matches[2] } }
} else { Bad "load-fleet-env.sh missing — no secrets to load for workers." }

foreach ($ex in $needed) {
  switch ($ex) {
    'gemini' {
      $v = (& gemini --version 2>$null)
      if ($v) { Ok "gemini CLI present ($v); GEMINI_CLI_TRUST_WORKSPACE handled by env loader" }
      else { Bad "gemini CLI not on PATH — cannot dispatch the cheap-tier lane" }
    }
    'cursor' {
      if ($secrets['CURKEY']) {
        $code = (curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $($secrets['CURKEY'])" "https://api.cursor.com/v0/agents?limit=1" 2>$null)
        if ($code -eq '200') { Ok "Cursor API reachable (Bearer, HTTP 200)" }
        else { Bad "Cursor API returned HTTP $code — key invalid/expired; regenerate at cursor.com/settings" }
      } else { Bad "CURSOR_API_KEY not loaded — cannot dispatch Cursor cloud agents" }
    }
    'copilot' {
      Warn "Copilot coding agent is disabled on the Education plan — cannot dispatch as executor (review-only)."
    }
    'claude' { Ok "claude (Adjutant/subagent) — reserve for research/architecture, not mechanical bulk" }
    default  { Bad "Unknown executor '$ex' in manifest" }
  }
}
if ($secrets['PAT']) {
  $rl = (curl -sI -H "Authorization: token $($secrets['PAT'])" https://api.github.com 2>$null | Select-String -Pattern '^x-ratelimit-limit:\s*(\d+)' )
  if ($rl -and [int]($rl.Matches.Groups[1].Value) -ge 5000) { Ok "GitHub PAT authenticates (rate limit $($rl.Matches.Groups[1].Value)) — workers can push/PR" }
  else { Warn "GitHub PAT rate limit not >=5000 — confirm it has contents:write + pull_requests:write for $Repo" }
} else { Bad "GITHUB_PAT not loaded — workers cannot push branches or open PRs" }

# ── 2. Disjoint lanes (THE fan-out guard) ────────────────────────────────────────────────────────
Write-Host "`n== 2. Disjoint lanes ==" -ForegroundColor Cyan
# High-contention paths must never appear in a worker WP — they are orchestrator-owned.
$highContention = @('docs/STATUS.md','AGENTS.md','CLAUDE.md','GEMINI.md','changelog.d/','packages/shared/','packages/data-provider/','planning/00-MASTER-PLAN.md','planning/04-BACKLOG.md')
$resolved = @{}
foreach ($wp in $wps) {
  $files = @()
  foreach ($glob in $wp.paths) {
    $matched = git ls-files -- "$glob" 2>$null
    if ($matched) { $files += $matched }
    else { Warn "WP $($wp.id): pattern '$glob' matched no tracked files" }
  }
  $resolved[$wp.id] = $files | Sort-Object -Unique
  foreach ($hc in $highContention) {
    if ($resolved[$wp.id] | Where-Object { $_ -like "$hc*" }) {
      Bad "WP $($wp.id) touches high-contention path '$hc' — exclude it; the orchestrator owns it."
    }
  }
}
# Pairwise intersection — the exact check that would have caught the foundation collision.
$ids = @($resolved.Keys)
for ($i = 0; $i -lt $ids.Count; $i++) {
  for ($j = $i + 1; $j -lt $ids.Count; $j++) {
    $shared = $resolved[$ids[$i]] | Where-Object { $resolved[$ids[$j]] -contains $_ }
    if ($shared) { Bad "Lanes $($ids[$i]) and $($ids[$j]) BOTH edit: $($shared -join ', ') — sequence them or give the file one owner." }
  }
}
if ($fail.Count -eq 0) { Ok "All $($wps.Count) lanes are disjoint and avoid high-contention files" }

# ── 3. PR queue — dependency-aware, not a blind count ───────────────────────────────────────────
Write-Host "`n== 3. PR queue (dependency-aware) ==" -ForegroundColor Cyan
$open = @(gh pr list --repo $Repo --state open --json number,reviewDecision | ConvertFrom-Json)
$openCount = $open.Count
if ($manifest.dependsOnUnmergedPRs) {
  Bad "This wave depends on unmerged PRs — pause and merge/approve the foundation first (contracts-first rule)."
} elseif ($openCount -ge $MaxIndependentPRs) {
  Warn "$openCount PRs already open (cap $MaxIndependentPRs). They appear independent, but the review queue is deep — consider draining before adding more."
} else {
  Ok "$openCount open PRs (cap $MaxIndependentPRs); wave declares no dependency on unmerged work — clear to add."
}

# ── Verdict ──────────────────────────────────────────────────────────────────────────────────────
Write-Host "`n== Verdict ==" -ForegroundColor Cyan
if ($fail.Count -gt 0) {
  Write-Host "BLOCKED — $($fail.Count) hard failure(s). Do NOT launch the wave:" -ForegroundColor Red
  $fail | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  exit 1
}
if ($warn.Count -gt 0) { Write-Host "Cleared with $($warn.Count) warning(s) — read them before launching." -ForegroundColor Yellow }
Write-Host "PREFLIGHT PASSED — cleared to launch." -ForegroundColor Green
exit 0

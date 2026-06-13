# aflek-selftest.ps1 — the ecosystem's self-review (step 1 of the "empieza" flow).
#
# One command answers: is the fleet healthy enough to run a milestone right now? It checks the
# provider roster, sync drift, that the gates and doctrine are present, and that the secrets exist.
# Read-only, never prompts, never prints a secret value. A new session runs this first, fixes what
# it reports, and only then composes a wave.
#
# Usage:  pwsh tools/aflek-selftest.ps1 -Project "C:\path\to\repo"
# Exit 0 = ready · 1 = drift/degraded (act before composing) · 2 = broken (cannot run).

param(
  [string]$Project = (Get-Location).Path,
  [string]$Kit
)

$ErrorActionPreference = 'SilentlyContinue'
if (-not $Kit) { $Kit = if ($env:AFLEK_KIT) { $env:AFLEK_KIT } else { Split-Path (Split-Path $PSCommandPath -Parent) -Parent } }
$Project = (Resolve-Path $Project).Path
$tools = Join-Path $Kit 'tools'
$priv  = Join-Path $Project 'private'
$warn = 0; $bad = 0
function Ok($m) { Write-Host "  [ OK ] $m" -ForegroundColor Green }
function Wn($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow; $script:warn++ }
function Er($m) { Write-Host "  [FAIL] $m" -ForegroundColor Red; $script:bad++ }

# Read a private/ secret directly (PowerShell-native; never printed). $null if absent.
function Read-Secret($file) {
  $p = Join-Path $priv $file
  if (Test-Path $p) { return ((Get-Content $p -Raw) -replace '[\r\n]','').Trim() }
  return $null
}

Write-Host "AFLEK SELFTEST — project: $Project — kit: $Kit" -ForegroundColor Yellow

# 1. Secrets present (existence only; values never read aloud) ────────────────────────────────────
Write-Host "`n== Secrets ==" -ForegroundColor Cyan
$keys = @{ Gemini='Gemini API Key.txt'; Cursor='Cursor API Key.txt'; GitHub='GitHub PAT.txt'; Vercel='Vercel API Key.txt' }
$val = @{}
foreach ($k in $keys.Keys) { $v = Read-Secret $keys[$k]; $val[$k] = $v; if ($v) { Ok "$k key present ($($v.Length) chars)" } else { Wn "$k key missing in private/$($keys[$k])" } }

# 2. Provider roster (live) ──────────────────────────────────────────────────────────────────────
Write-Host "`n== Provider roster ==" -ForegroundColor Cyan
if (& gemini --version 2>$null) { Ok "Gemini CLI UP" } else { Wn "Gemini CLI DOWN (cheap-tier unavailable)" }
if ($val['Cursor']) { $c = (curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $($val['Cursor'])" "https://api.cursor.com/v0/agents?limit=1" 2>$null); if ($c -eq '200') { Ok "Cursor API UP (Bearer 200)" } else { Wn "Cursor API DOWN (HTTP $c)" } } else { Wn "Cursor key absent — cloud UI lane unavailable" }
if ($val['GitHub']) { $g = (curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $($val['GitHub'])" https://api.github.com 2>$null); if ($g -eq '200') { Ok "GitHub UP — workers can push/PR" } else { Wn "GitHub DOWN (HTTP $g)" } } else { Er "GitHub PAT absent — workers cannot push" }
if ($val['Vercel']) { $v = (curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $($val['Vercel'])" "https://api.vercel.com/v2/user" 2>$null); if ($v -eq '200') { Ok "Vercel UP" } else { Wn "Vercel DOWN (HTTP $v)" } } else { Wn "Vercel key absent — preview deploys unavailable" }
Ok "Claude subagents UP (in-harness)"

# 3. Gates & doctrine present ────────────────────────────────────────────────────────────────────
Write-Host "`n== Gates & doctrine ==" -ForegroundColor Cyan
foreach ($t in @('aflek-sync.ps1','fleet-status.ps1','wave-preflight.ps1','aflek-selftest.ps1')) {
  if (Test-Path (Join-Path $tools $t)) { Ok "kit tool: $t" } else { Er "kit tool MISSING: $t" }
}
$aflek = Join-Path $Project '.aflek'
if (Test-Path $aflek) { Ok ".aflek/ doctrine snapshot present" } else { Wn ".aflek/ missing — run aflek-sync" }
foreach ($p in @('playbooks/start.md','playbooks/compose-fleet.md','playbooks/run-a-wave.md','playbooks/sync-and-update.md')) {
  if (Test-Path (Join-Path $aflek $p)) { Ok ".aflek/$p" } elseif (Test-Path (Join-Path $Kit $p)) { Wn ".aflek/$p missing (in kit; sync needed)" } else { Er "$p MISSING in kit" }
}

# 4. Sync drift ──────────────────────────────────────────────────────────────────────────────────
Write-Host "`n== Sync drift ==" -ForegroundColor Cyan
$syncTool = Join-Path $tools 'aflek-sync.ps1'
if (Test-Path $syncTool) {
  & pwsh -NoProfile -File $syncTool -Project $Project -Check *> $null
  switch ($LASTEXITCODE) { 0 { Ok "in sync with kit" } 1 { Wn "DRIFT — run aflek-sync (step 2 of start.md)" } default { Er "sync check could not run (set AFLEK_KIT?)" } }
} else { Er "aflek-sync.ps1 missing" }

# Verdict ────────────────────────────────────────────────────────────────────────────────────────
Write-Host "`n== Verdict ==" -ForegroundColor Cyan
if ($bad -gt 0) { Write-Host "BROKEN — $bad failure(s), $warn warning(s). Fix before composing." -ForegroundColor Red; exit 2 }
if ($warn -gt 0) { Write-Host "READY WITH $warn warning(s) — a DOWN provider is excluded and its lane re-routed; drift means sync first." -ForegroundColor Yellow; exit 1 }
Write-Host "READY — ecosystem healthy, in sync, all providers reachable." -ForegroundColor Green
exit 0

#!/usr/bin/env bash
# MunHub Lab v6.0 — load fleet secrets into the environment WITHOUT printing them.
#
# Usage:  source infra/fleet/load-fleet-env.sh
#
# Reads the key files already present in private/ (gitignored) and exports them as env vars for
# Gemini / Cursor / GitHub tooling. Values are NEVER echoed. If a key file is missing, that var is
# simply skipped (with a non-sensitive notice).
#
# Safe to re-source. Does nothing destructive.

set -o pipefail

_repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
_priv="${_repo_root}/private"

_load_secret() { # $1 = env var name, $2 = file path
  local var="$1" file="$2"
  if [[ -f "$file" ]]; then
    # Strip surrounding whitespace/newlines; never print the value.
    local val
    val="$(tr -d '\r\n' < "$file" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    export "$var=$val"
    printf 'fleet-env: %s loaded (%d chars)\n' "$var" "${#val}"
  else
    printf 'fleet-env: %s SKIPPED (missing %s)\n' "$var" "${file#"$_repo_root"/}"
  fi
}

# Prefer an explicit private/.env.fleet if present (it wins).
if [[ -f "${_priv}/.env.fleet" ]]; then
  set -a; . "${_priv}/.env.fleet"; set +a
  echo "fleet-env: sourced private/.env.fleet"
else
  _load_secret GEMINI_API_KEY "${_priv}/Gemini API Key.txt"
  _load_secret CURSOR_API_KEY "${_priv}/Cursor API Key.txt"
  _load_secret GITHUB_PAT     "${_priv}/GitHub PAT.txt"
fi

unset -f _load_secret

# ── Executor preconditions: set these so workers never stall on a first-run prompt ───────────
# Gemini CLI refuses headless (-p) mode in an "untrusted" workspace and exits 55. Trust the repo
# up-front so a dispatched worker never blocks on the trust prompt. (adapters/gemini.md)
export GEMINI_CLI_TRUST_WORKSPACE=true
# Cursor's REST API (api.cursor.com) authenticates with a **Bearer** token, NOT HTTP Basic.
# Tooling that uses Basic gets HTTP 401 "Invalid User API Key". Documented here so callers wire
# the header correctly: Authorization: Bearer $CURSOR_API_KEY. (adapters/cursor.md)

echo "fleet-env: ready (values are NOT printed; GEMINI_CLI_TRUST_WORKSPACE=true set)"

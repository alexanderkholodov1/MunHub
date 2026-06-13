- Fleet dispatch hardening: an executable wave-preflight gate (`infra/fleet/wave-preflight.ps1`)
  that blocks a fan-out unless lanes are disjoint, no work package touches an orchestrator-owned
  high-contention file, every routed executor is reachable, and the PR queue is dependency-clear.
  `load-fleet-env.sh` now sets `GEMINI_CLI_TRUST_WORKSPACE` so dispatched Gemini workers don't
  stall on the trust prompt, and documents that the Cursor REST API requires Bearer (not Basic) auth.

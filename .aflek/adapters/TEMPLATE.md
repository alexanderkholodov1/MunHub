# Adapter — {{PROVIDER}}   *(AFLEK template — add ANY provider with this file)*

> AFLEK is provider-agnostic by construction: the contract is `AGENTS.md` (the open standard),
> the deliverable is a PR, and CI is the referee. Supporting a new provider — current or
> future — never requires changing the kit; it requires answering the five questions below in
> a new `adapters/<provider>.md`. If the provider can read a file and open a PR, it can serve
> in the fleet.
>
> **Last verified:** YYYY-MM-DD. Re-verify quarterly (doctrine 3) — surfaces and billing move.

## 1. Where it runs

| Surface | Use for |
|---|---|
| <!-- cloud agent / scheduled / CI-triggered / local-interactive --> | <!-- which WP kinds --> |

Doctrine-1 check: which of its surfaces are cloud? Local surfaces are limited to ONE
interactive session.

## 2. How to start a task

<!-- The exact mechanics: where you paste the work package, how it receives the repo, how it
     reports progress. If it has an Issue→PR mode, say so — the WP text is the issue body. -->

## 3. How the contract reaches it

<!-- Does it read AGENTS.md natively (preferred — it is the Linux Foundation standard)? If it
     reads its own file, which shim template applies or what new shim is needed (add it to
     templates/shims/ in the same PR as this adapter). Sync tools (ruler, agent_sync) can
     generate shims for a dozen harnesses from one source. -->

## 4. Strengths / routing

<!-- Which doctrine-7 lane: frontier (contracts/review) · mid-tier (implementation) · cheap
     (mechanical bulk) · cross-provider reviewer. What it is genuinely good at. -->

## 5. Cost / billing cautions

<!-- Plan/seat model, metered surfaces, the failure mode that silently burns money (stuck
     retry loops, over-eager schedules), and the kill switch. -->

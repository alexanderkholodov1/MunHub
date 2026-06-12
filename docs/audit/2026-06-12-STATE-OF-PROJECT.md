# State of the project — audit & reconstruction work packages

> **Date:** 2026-06-12 · **Author:** Adjutant session (project audit)
> **Audience:** the maintainer and every future agent session. This document is self-contained:
> nothing in it depends on any chat history. It records (1) what the audit found, (2) the
> external research that informed the decisions, (3) the decision queue for the maintainer, and
> (4) numbered work packages (WP-NN) specced so a mid-tier model can execute each one alone.
> When a WP lands, mark it here and update `docs/STATUS.md`.

---

## 1. Executive summary

The v6 reconstruction is **structurally healthy**: the monorepo scaffold, CI quality gate,
protected `main`, design language, and a coherent decision log (D1–D46) all exist, and the first
two foundation specs (shared contracts, `DataProvider` interface) are sitting in **open PRs #24
and #25 awaiting maintainer review** — that queue, not missing work, was the real F1 blocker.

The main liabilities are **documentation hygiene and process drift**, not architecture:

- The two agent entry points contradicted each other: root `CLAUDE.md` still described the dead
  v5 static app ("no build step, no test suite"), and `AGENTS.md` was written in Spanish in an
  English-mandated public repository — every new agent session started misinformed.
  **Fixed in this PR** (both rewritten; v5 knowledge preserved in
  `docs/technical/V5-LEGACY-REFERENCE.md`).
- The 21-file `planning/` layer is in Spanish (policy D29 allowed this "until the repo goes
  public" — it already is public). → WP-01.
- GitHub issues #3–#18 carry the superseded D30 policy ("no auto-commits") that contradicts the
  active D32 policy (branch → commit → push → PR). → WP-02.
- Spec numbering diverged three ways (backlog S-numbers vs `specs/NNNN-*` folders vs STATUS).
  Canonical going forward: **the `specs/NNNN-*` folders**. → WP-03.
- A handful of scientific claims are overstated or unpinned (worst: "highest geomagnetic cutoff
  rigidity in the world" — the global maximum is over Southeast Asia; Ecuador is *among* the
  highest). README softened in this PR; number-pinning → WP-04.
- The multi-provider fleet was designed to run implementers **locally**, which degraded the
  maintainer's machine and produced no visible feedback. The fix is doctrinal, not architectural:
  cloud-first execution + the PR queue + `docs/STATUS.md` as the only feedback surfaces. → WP-07.

---

## 2. Audit findings (detail)

### 2.1 What is genuinely good (keep, defend)
- **Decision log D1–D46** in `planning/00-MASTER-PLAN.md`: real engineering decisions with
  rationale. This is the project's most valuable planning artifact.
- **`docs/research/THEORETICAL-FOUNDATION.md`**: scientifically serious (MIP indistinguishability,
  dead-time correction, local barometric β, Poisson windows ≥ hours, honest GLE expectations).
  Independent fact-checks confirmed the barometric coefficient range for muon counters
  (−0.1…−0.3 %/hPa, e.g. DANSS EPJ C 2022) and the √N/dead-time practice. Needs translation
  (WP-01) and number-pinning (WP-04), not rework.
- **`docs/design/DESIGN-LANGUAGE.md`** ("Observatory Dark") incl. the anti-"AI-look" doctrine:
  professional and complete. The remaining design work is the landing (→ §5).
- **CONTRIBUTING.md, CHANGELOG.md, changelog.d/ fragments, PR template, CI + gitleaks +
  protected `main`**: all working and consistent.
- **PRs #24/#25**: well-described, stacked correctly, follow D44 style.

### 2.2 Defects found
| # | Defect | Evidence | Disposition |
|---|---|---|---|
| 1 | `CLAUDE.md` described v5; repo is v6 monorepo | old line "There is no build step, bundler, or test suite" | **fixed in this PR** |
| 2 | `AGENTS.md` in Spanish; self-contradictory (guardrail 1 said commit+push+PR; "first task" §4 said *leave it for the human to commit*) | old AGENTS.md §guardrails vs §task selection | **fixed in this PR** (D32 is the single truth) |
| 3 | `planning/*` (21 files) in Spanish in a public repo | whole directory | WP-01 |
| 4 | Issues #3–#18 embed superseded D30 text and stale S-numbers | issue bodies, e.g. #6 "S04 - packages/physics" | WP-02 / WP-03 |
| 5 | Spec numbering divergence (backlog vs `specs/` vs STATUS) | backlog S05="DataProvider interface" vs folder `specs/0004-data-provider-interface` | WP-03 |
| 6 | Overstated science claims | README "highest cutoff rigidity in the world (~14–17 GV)"; foundation §0/§8E "la mayor del planeta (14–16.8 GV)" — global max ≈17 GV sits over Southeast Asia; Quito vertical cutoff is commonly cited ≈12–13 GV | README softened **in this PR**; pin numbers via WP-04 |
| 7 | `planning/research/DEEP-RESEARCH-RESULTS.md` (57 KB) self-describes as "temporal, descartable" but still committed | its own header | WP-05 |
| 8 | ADR-002 (local agent framework) ends with a question to the maintainer instead of a decision | "Pendiente para el humano: ¿…?" | Decision Q3 below, then WP-06 |
| 9 | Fleet doctrine assumed local execution of parallel agents (machine lag; no feedback loop) | `planning/18 §1` (local CLI inventory) | WP-07 |
| 10 | `docs/STATUS.md` was 5 days stale and unaware of PRs #24/#25 | previous content | **fixed in this PR** |
| 11 | GitHub repo description still v5-era ("Data dashboard for MuNRa project…") | repo settings | maintainer 1-click (Decision Q6) |
| 12 | Naming drift: "MunHub" vs "MunHub Lab" | README title vs package names | Decision Q5 |

### 2.3 The "averages, never sums" artifact — resolved by reframing
The phrase (originally a maintainer correction echoed verbatim into docs) encoded a real
invariant badly. The professional statement, now in `AGENTS.md` guardrail 5 and
`V5-LEGACY-REFERENCE.md`: *per-minute values are time-averages so that records of different
completeness remain comparable across detectors and sessions; statistical uncertainties are
derived from raw counts (√N), not from the averaged values* (foundation §10). Rule kept,
chat-artifact phrasing retired.

---

## 3. External research record (2026-06-12)

Full agent reports are summarized here so no future session repeats the research.

### 3.1 ECC — `github.com/affaan-m/ECC` → `everything-claude-code`
MIT-licensed, ~214k stars, very active (v2.0.0, June 2026). A curated core with a long community
tail; known token-bloat and hook-fragility issues; **pin a commit, cherry-pick files, never
install wholesale.** Worth adopting:
- **For MunHub (WP-08):** `agents/silent-failure-hunter.md` (Firebase listeners swallow errors),
  `agents/security-reviewer.md` + `rules/common/security.md` (database rules, role gating),
  `agents/code-reviewer.md`, `skills/verification-loop/SKILL.md` — these become the L3 reviewer
  personas of `planning/18 §6 Layer C`.
- **For The Fleet (see `fleet/`):** its **adapter architecture** — canonical `.agents/` dir
  + per-harness adapters (`.claude/`, `.cursor/`, `.codex/`, `.gemini/`, `.opencode/`) with
  `docs/SESSION-ADAPTER-CONTRACT.md` — plus skills-as-portable-unit, the `orch-*`/GAN
  planner-generator-evaluator orchestration patterns, and `rules/common/*` base rulesets.
- Not worth taking: its Node hook implementations (Claude-Code-version brittle), 84 slash-command
  shims, Rust control-pane, niche vertical skills.

### 3.2 Hermes & OpenClaw — verdict: not for us
- **OpenClaw** (ex-Clawdbot/Moltbot, Peter Steinberger): a **personal-assistant gateway**
  (WhatsApp/Telegram → one agent), not a coding-agent orchestrator. Security record is
  disqualifying for a project holding Firebase/GitHub credentials: ~135k internet-exposed
  instances (SecurityScorecard), 36% of marketplace skills with prompt injection (Snyk
  ToxicSkills), the ClawHavoc malicious-skill campaign, plaintext keys.
- **Hermes Agent** (Nous Research, Feb 2026): better engineered, same genus (self-hosted personal
  assistant). Its multi-agent machinery clones its own runtime; **orchestrating external coding
  CLIs (Claude Code/Codex/Gemini) is an open feature request** (issues #413/#344). Watch, don't
  adopt.
- **The actual mid-2026 fleet pattern is boring and proven:** cloud coding agents — Claude Code
  on the web + Routines, Cursor Cloud Agents (the maintainer already pays for these), Codex
  Cloud, `anthropics/claude-code-action` on GitHub Actions — all emitting **PRs into one repo
  with CI as referee**. No gateway product needed; MCP is the shared tool layer, not the
  orchestrator. This is the basis of WP-07 and of `fleet/`.

### 3.3 Git workflow norms
"AI never commits" is **not** current practice and discards the audit trail. The mainstream
pattern is exactly D32: agents make small commits on feature branches/worktrees, open PRs,
CI + branch protection gate the merge, the human reviews and merges. **D32 is confirmed; keep
it.** (Refs: Addy Osmani's 2026 AI coding workflow; GitHub community guidance.)

### 3.4 Science fact-checks (independent)
- Barometric coefficient for surface muon counters: negative, ≈ −0.1…−0.3 %/hPa (DANSS,
  EPJ C 2022; KACST detector −0.15…−0.29). Foundation §8A table is consistent. ✓
- Per-minute counts are Poisson; √N uncertainties on **counts** (not averaged mV) + dead-time
  correction are standard. Foundation §4/§10 are correct. ✓
- Cutoff-rigidity superlative: overstated (see §2.2 defect 6). → WP-04.
- "Claude Design" exists (Anthropic Labs research preview, April 2026) — the design-session plan
  in `docs/design/LANDING-CONCEPT.md` is actionable as written. → §5.

---

## 4. Decision queue for the maintainer

| # | Decision | Recommendation |
|---|---|---|
| Q1 | Merge PR #24 (shared contracts), then PR #25 (DataProvider interface) | ✅ **Done 2026-06-12** — both merged. |
| Q2 | Create a separate repository for **The Fleet** (provider-agnostic agent kit) | ✅ **Done 2026-06-12** — `alexanderkholodov1/fleet` created. Kit incubates in `fleet/` until the agent environment gets write access to it (then WP-10 extracts). |
| Q3 | ADR-002: local detector agent toolkit | **Tauri** (signed auto-updater, shared React UI, small footprint); Go documented as fallback. Convert ADR-002 to "accepted" (WP-06). |
| Q4 | ML layer public name & placement (proposal in §6) | Approve "**Insights**" (per-station tab) + "**Events**" (network feed); optional public brand **ANDES** for the pipeline. |
| Q5 | Canonical product name | "**MunHub Lab**" for the platform, "MunHub" acceptable as short form; never mix within one document. |
| Q6 | One-click chores: update GitHub repo description (e.g. "Open cosmic-ray observatory platform for Latin America — live detector network, research-grade corrections, open data"); enable Copilot review | Do when merging this PR. **Cursor Bugbot stays off** (usage-billed; maintainer decision 2026-06-12) — Claude reviewer personas (WP-08) + Copilot keep the two-reviewer ensemble (D35). |
| Q7 | Repo visibility while WP-01 (translation) lands | Optional: keep public — entry points are now clean; planning translation is cosmetic. |

---

## 5. Design: the landing session (ready to execute)

`DESIGN-LANGUAGE.md` is the contract; `LANDING-CONCEPT.md` holds the seed (cursor-as-mass
particle field). Run a session in **Claude Design** (Anthropic Labs) or Figma Make, paste the
prompt below, then bring outputs back as references for the `apps/web` landing spec
(tokens stay authoritative in `packages/ui`):

```
Design a public landing page for "MunHub Lab" — an open cosmic-ray observatory network across
Latin America. It must feel like serious scientific-instrument software, NOT a generic SaaS.

Design system "Observatory Dark" (binding): bg #0B0E14, surface #131722, border #252C3B,
text #E6EAF2 / secondary #9AA4B2; ONE cyan accent #4CC9F0 used sparingly + amber #F5B544 for
highlights; Geist Sans UI + Geist Mono for ALL numbers (tabular); body ≥16px; 8-pt grid; Lucide
icons; no gradients/glows/emoji; WCAG AA.

Hero: a field of faint stars and cosmic-ray streaks where the cursor acts as a gravitational
mass, bending nearby particle trajectories (gravitational-lensing metaphor). One restrained
motion only; honors prefers-reduced-motion.

Sections: (1) hero with one-line mission + live corrected particle-rate readout (mono),
(2) map of Latin America with city-aggregated detector bubbles, (3) "Why Ecuador" — among the
highest geomagnetic cutoff rigidities on Earth (galactic-pure signal), (4) how it works
(detector → agent → corrected science), (5) open data / join the network CTA for universities.
Tone: calm, precise, data-forward; the data is the hero. Deliver: desktop + mobile hero,
full landing flow, and an OG/social image.
```

---

## 6. ML layer — product definition (proposal, extends `planning/06-AI-DESIGN.md`)

`planning/06` has sound foundations (classical ML first; Poisson windows ≥ hours; champion/
challenger retraining; physicist veto). What it lacked — name, surface, contract, and an early
win — is proposed here:

- **Names.** Pipeline/service: `services/ai` (no mascot branding). Optional public brand:
  **ANDES** — *ANomaly Detection & Event System* (honest, region-rooted). UI surfaces: a
  per-station **"Insights"** tab and a network-level **"Events"** page.
- **Placement.** Station dashboard → Insights tab: baseline ("normal for this site"), forecast
  band, anomaly flags with plain-language explanations (template-generated, physicist-approved
  wording only). Network → Events: Forbush candidates with multi-station coincidence + NMDB
  cross-check. Admin → Models: registry, versions, metrics, champion/challenger state.
- **Contract.** `ai_insights` records (already planned, S41): `{detector_id, kind, ts_range,
  result(jsonb), model_version, confidence}` — written only by `services/ai`, read via
  `DataProvider`, rendered by `apps/web`. External APIs (NMDB/NOAA/DONKI/Kp-Dst) land in
  `external_events` first; ML consumes both. No paid LLM APIs (D12).
- **Earlier win (new proposal).** Ship **"Insights v0" in F3, before any ML**: pure statistics —
  robust per-site baseline (median/IQR over solar-quiet history), √N error bands, pressure- and
  dead-time-corrected rate with local β from `packages/physics`. Zero servers, immediate
  scientific value, and it makes the eventual ML measurable against an honest baseline. → WP-09.

---

## 7. Work packages

> Format: every WP is executable by a mid-tier model with ONLY the files listed. Router: suggested
> provider per `planning/18 §3`. Each WP ships as one PR obeying `AGENTS.md` (spec where code is
> touched, changelog fragment, doc matrix).

**WP-01 — Translate `planning/` to English.** Files: all 21 `planning/*.md` +
`planning/research/`, `docs/research/THEORETICAL-FOUNDATION.md`, `specs/0001`, `specs/0002`.
Rules: translate faithfully; keep D-numbers, tables, file references intact; do NOT alter
decisions or numbers (WP-04 owns numbers); remove conversational phrasing ("Pendiente para el
humano", direct address) in favor of neutral register; one PR per ~5 files to keep review
tractable. Router: Gemini or Sonnet; spot-review by Adjutant. Acceptance: no non-English prose
left outside i18n translation files; `rg '[áéíóúñ¿¡]' --glob '!public/js/auth.js' --glob '!pnpm-lock.yaml'` returns nothing.

**WP-02 — Re-issue the GitHub issue queue.** Close #3–#18 with a comment linking their
replacement; recreate from the renumbered backlog (after WP-03) with D32-correct workflow text
and the AGENTS.md documentation matrix in the Definition of Done. Router: Haiku/scripted.

**WP-03 — Unify spec numbering.** Canonical = `specs/NNNN-*` folders. Renumber
`planning/04-BACKLOG.md` to match (0001 scaffold, 0002 ci-cd, 0003 shared-contracts,
0004 data-provider-interface, 0005 physics, …), regenerate the STATUS table, add a mapping
table old→new at the bottom of the backlog. Router: Sonnet. Acceptance: grep shows no stale
S-references in STATUS/backlog/AGENTS.

**WP-04 — Pin scientific numbers.** Verify with citations: Quito/Andes vertical cutoff rigidity
(IGRF-based; expect ≈12–13 GV — correct foundation §0.5/§8E and any "highest on the planet"
phrasing to "among the highest"), CosmicWatch v2/v3X dead times vs arXiv:2508.12111, muon
barometric β table refs. Update `THEORETICAL-FOUNDATION.md` + README if numbers change. Router:
Claude with web search; physicist-persona review. Acceptance: every number in foundation §0 has
a citable source in §13.

**WP-05 — Retire `planning/research/DEEP-RESEARCH-RESULTS.md`.** Harvest any citation not yet in
the foundation's §13, then delete the file (git history preserves it); update
`planning/00 §6` checklist. Router: Haiku. Blocked by: WP-04.

**WP-06 — Close ADR-002.** After Q3: rewrite as an accepted decision in English (status,
context, decision, consequences), drop the question-to-the-maintainer ending. Router: Sonnet.

**WP-07 — Fleet doctrine v2 (cloud-first).** Rewrite `planning/18 §1/§4` and `planning/20 §3`
(within WP-01's translation or as its own PR): execution surfaces are Claude Code web/cloud
sessions + Routines, Cursor Cloud Agents, Copilot coding agent, GitHub-Actions agents — **no
parallel agents on the maintainer's machine**; local CLIs only for single interactive sessions.
Feedback loop is mandatory: every wave ends by updating `docs/STATUS.md` + the PR queue; the
Adjutant subscribes to PR activity. Router: Adjutant (policy) — this paragraph is the spec.

**WP-08 — Import ECC reviewer personas.** Create `.claude/agents/` with `code-reviewer`,
`security-reviewer`, `silent-failure-hunter` adapted from `everything-claude-code` (pin the
commit, keep MIT attribution headers, adapt examples to TS/Firebase/zod). Wire them into the PR
review flow (`planning/18 §6 Layer C`). Router: Sonnet.

**WP-09 — Spec "Insights v0".** Write `specs/000X-insights-v0/spec.md` per §6: per-station
baseline + corrected rate + error bands, computed client-side from `packages/physics`; no
backend. Router: Opus/Adjutant writes spec → Sonnet implements after S03/S04/physics merge.

**WP-10 — Extract The Fleet.** After Q2: create the `fleet` repo from `fleet/README.md`,
port the generalizable assets listed there, then delete `fleet/` from MunHub and have
MunHub *consume* the fleet kit as its first customer. Router: Adjutant session in the new repo.

**Sequencing:** Q1 (merge #24/#25) → WP-03 → WP-02 → WP-01 (waves) ∥ WP-04 → WP-05/WP-06 ∥
WP-07/WP-08 anytime ∥ WP-09 after physics package exists ∥ WP-10 after Q2.

---

## 8. Standing rules reaffirmed by this audit

1. **No chat-dependent state.** Every session ends with pushed branches, PR Stage Reports, and
   STATUS updated. Plans of record live in `docs/audit/` or `planning/`, never only in a chat.
2. **Context economy.** Workers receive only their WP text and the files it lists — not the
   whole planning corpus. The reading order in `AGENTS.md` is for supervisors/orchestrators.
3. **English-only repo**, with i18n translations as the sole exception (D28/D29 as amended in
   `AGENTS.md`).
4. **The entry points must never drift:** any policy change updates `AGENTS.md` + all shims in
   the same PR (documentation matrix, row "Process or agent policy").

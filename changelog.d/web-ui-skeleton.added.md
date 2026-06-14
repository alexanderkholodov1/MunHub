- Observatory Dark design token foundation in `@munhub/ui`: full CSS custom property set (dark
  default + light mirror, per `DESIGN-LANGUAGE.md` §1–§3), Tailwind v4 `@theme` mapping semantic
  tokens to utility classes (`bg-surface`, `text-secondary`, `rounded-md`, etc.).
- Primitive set in `@munhub/ui`: `ThemeProvider` (dark/light toggle, `localStorage` persist,
  `prefers-reduced-motion` aware), `Button` (primary / secondary / ghost variants; all states),
  `Card` (title + body; empty / loading / error states), `Stat` KPI tile (Geist Mono
  `tabular-nums` readout; loading / error states). All exported from `packages/ui/src/index.ts`.
- `apps/web` Next.js App Router shell with `output: "export"` (static build → `out/` for Firebase
  Hosting, Phase A). Real `next build` / `next dev` scripts replace stubs.
- Root layout: Geist Sans (UI) + Geist Mono (numbers) via `next/font`, Observatory Dark tokens
  global stylesheet, `ThemeProvider` wrapping the app, `<html data-theme="dark">` default.
- `SiteHeader`: MunHub wordmark, nav placeholders, working light/dark toggle.
- `/` route: calm on-brand landing with real scientific cosmic-ray copy (no lorem ipsum, no
  particle animation — design session deferred per `LANDING-CONCEPT.md`).
- `/dashboard` route: `Card` + `Stat` primitives with realistic USFQ station sample readouts;
  interactive empty / loading / error state demo satisfying FR8 and §0 requirement.

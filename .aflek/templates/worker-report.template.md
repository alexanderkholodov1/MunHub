# Worker report — <executor> · <task id>

> An executor finishes a task by filing THIS to its squad-lead — **not** by opening a PR. The
> squad-lead cannot consolidate without it. Keep it factual and short.

- **Task:** <the acotada task as assigned>
- **Lane (files touched):** <exact paths — must match the assigned lane; flag any drift>
- **Done:** <what was produced, in one or two lines>
- **Self-check:** <which acceptance criteria were met, how verified (tests/grep/build)>
- **Problems / surprises:** <anything that stalled, was ambiguous, or needed a judgment call —
  this is where process incidents surface; "none" is a valid answer but think before writing it>
- **Out-of-lane needs:** <anything you needed to touch outside your lane — STOP and report it,
  do not edit it; the squad-lead or Adjutant owns cross-lane changes>
- **Status:** complete / blocked / partial — <if not complete, exactly what remains>

> The squad-lead reads this, checks partial consistency against sibling reports, and either
> integrates the lane or sends it back. Nothing reaches a PR unreviewed.

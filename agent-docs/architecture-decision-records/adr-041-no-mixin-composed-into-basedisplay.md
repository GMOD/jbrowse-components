---
status: Rejected
summary: "Don't factor shared display state into a mixin composed at the BaseDisplay root — it exhausts MST's type-inference depth and silently drops later mixins' members"
---

# ADR-041: No mixin composed into `BaseDisplay`; shared policy at that level is a plain function

## Status

Rejected (2026-07). Discovered while single-sourcing the status-throttle policy
(see [PROGRESS_REPORTING.md](../reference/PROGRESS_REPORTING.md) §"The stream is
throttled on the callback, never on the write").

## Context

`BaseDisplayModel` and `FetchMixin` both declare the same five members —
`error`, `statusMessage`, `statusProgress`, `setError`, `setStatusMessage`.
Every real display composes both, so one set shadows the other; the
implementations were identical, so nothing was visibly wrong.

It stopped being harmless the moment the two needed to differ. Adding a throttle
to `BaseDisplayModel.setStatusMessage` would have had no effect on any LGV
display, because `MultiRegionDisplayMixin` composes `FetchMixin` *after*
`BaseDisplay` and `FetchMixin`'s unthrottled copy wins. A shadowed member is a
silent correctness trap, not just duplication.

The obvious fix is to name the concept: extract a `DisplayStatusMixin` owning
those five members, and compose it into both `BaseDisplay` and `FetchMixin`. One
definition, composed twice, no shadowing — MST merges identical members happily.

## Decision

**Do not compose a mixin into `BaseDisplay`.** It is already at the type-inference
depth budget; add to it with `.props` / `.volatile` / `.views` / `.actions`
instead. Where a policy genuinely has to be shared across that boundary, make it
a **plain function** the duplicated members call.

### What actually happened

`types.compose('BaseDisplay', DisplayStatusMixin(), types.model({ … }))`
typechecks in isolation and looks correct. It then broke **twelve unrelated call
sites** across three plugins, because one extra compose layer at the root pushed
the deeper display chains past what TypeScript will infer through MST's
`_OverrideProps` nesting. Properties contributed by mixins *later* in those
chains fell out of the inferred instance type:

```
plugins/wiggle/src/LinearWiggleDisplay/model.ts(309,63): error TS2741:
  Property 'displayCrossHatches' is missing in type
  'ModelInstanceTypeProps<_OverrideProps<_OverrideProps<_OverrideProps<
   _OverrideProps<Omit<_OverrideProps<{}, { … }>, never>, Omit<…>>, { … }>, { …'
  but required in type '{ displayCrossHatches: boolean; … }'
```

Also lost: `treeAreaWidth`, `resolution`, `layout`, `ignorePromotedDefaults` —
across `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`,
`MultiSampleVariantBaseModel`, `LinearMultiSampleVariantMatrixDisplay`, and two
component files.

The failure mode is what makes this worth an ADR: the error surfaces **far from
the edit**, names a property the edit never touched, and reads like the *other*
mixin is broken. Nothing points at `BaseDisplay`. A future author who hits a wall
of these after adding a compose layer somewhere central should suspect depth
before suspecting the members being reported.

### What was done instead

`applyStatusUpdate` → ultimately `createStatusThrottle()`
(`@jbrowse/core/util/progress.ts`): a plain closure-based leading-edge window,
created once per display, called by both `FetchMixin`'s status-callback
factories and `createStopTokenRotation`. The five duplicated member declarations
stay, with a comment saying why; the *policy* they could drift on lives in one
function neither of them owns.

Same shape as the other cross-cutting display policies, which are all plain
functions for the same reason: `computeDisplayPhase`, `computeSvgReady`,
`isDataCurrent`, `viewportMatchesLastDrawn`.

## Consequences

- `BaseDisplay` stays a flat `types.model(…).volatile(…).views(…).actions(…)`
  chain. Adding a compose layer there is the change to avoid.
- The `BaseDisplay` / `FetchMixin` member duplication is deliberate and
  commented at both sites. Don't "fix" it by extracting a mixin; the compiler
  errors you get will not tell you that is what went wrong.
- This is a *typing* ceiling, not a runtime one — the composition works fine at
  runtime, which is why the failure is compile-time-only and looks unrelated.
  Recorded alongside the other unprotected-correctness items in
  [ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md).
- If MST's typings ever flatten `_OverrideProps` nesting (or the codebase moves
  off the fork's current inference shape), this is revisitable — the mixin is the
  cleaner factoring on the merits, and it was rejected purely on this cost.

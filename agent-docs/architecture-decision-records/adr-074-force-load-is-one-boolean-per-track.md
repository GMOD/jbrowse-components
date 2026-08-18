---
status: Accepted
summary: "Force-load is a single per-track boolean, not a per-region per-axis ceiling — every question a raised ceiling had to answer was unanswerable, and four of them shipped as bugs"
---

# ADR-074: Force-load is one boolean per track

## Status

Accepted (2026-08). The current mechanism is documented in
[REGION_TOO_LARGE.md § Force-load](../reference/REGION_TOO_LARGE.md).

## Context

"Load anyway" used to install a **raised numeric ceiling**, per region and per
axis: `userByteLimit` and `userFeatureDensityLimit` on the display,
`resolveForceLoadLimits` / `forceLoadByteLimit` to resolve them,
`raiseLimitPast` + `FORCE_LOAD_HEADROOM` to pick the new number, and two
`raiseForceLoadLimits` implementations to install it.

A ceiling has to answer four questions, and none of them has a good answer:

- **Which axis do we raise?** A tabix adapter reports an index-byte estimate even
  when the rejection was about *density*, so a dense-but-small region carried a
  small `bytes`. Adopting it as a ceiling installed a limit *below* the standing
  budget, which then wrongly gated later regions that really were large. The
  patch was a "only raise the byte axis if it actually lifts the baseline" rule.
- **Raise past which number?** The byte estimate is re-measured as the viewport
  moves, so a ceiling installed past one measurement is stale by the next.
  Raising past the measured number left the banner up after a zoom-out, which
  shipped as an LD bug. The density axis had to read the debounced
  `coarseBpPerPx`, never a live one, or a click mid-zoom raised past a number the
  gate was not comparing against.
- **Does raising one axis disable the other?** It did. `maxFeatureDensity`
  returned `undefined` whenever `userByteLimit` was set, so approving a track's
  *size* silently switched off its *density* gate for the rest of the chromosome.
- **When does a ceiling expire?** On chromosome navigation — but only
  `CanvasFeatureGateMixin` did the clearing, so the five non-canvas gated
  displays carried a raised ceiling to the next locus and downloaded it unguarded
  with no banner.

## Decision

**One volatile boolean for the whole track: `forceLoadTrack`.** `gateExempt` ORs
it with the declarative `forceLoad` config slot, and everything downstream — the
verdict, the worker byte budget, the worker density budget — reads that through
`gateActive` / `densityGateActive`.

All four questions become unrepresentable rather than handled. There is no
ceiling to install, so there is no axis to pick, no number to raise past, no
cross-axis interference, and nothing to expire.

## Consequences

- Force-load is all-or-nothing per track: a user who wanted one huge locus has
  the gate off for that track for the session. That is the intended scope. The
  gate exists to prevent an *unwitting* download, and a click on a banner quoting
  the size is witting.
- It survives chromosome navigation deliberately — `clearByteEstimate` drops the
  estimate, not the flag — because re-prompting per locus is the friction this
  replaced.
- Volatile, so it never reaches a saved or shared session; a recipient would
  otherwise download the same data with no warning and no visible reason. The
  durable escape hatch is the `forceLoad` config slot, which is what
  `jbrowse-img --force` sets.
- **A static span tier is not this decision wearing a hat.**
  `SUB_FLOOR_BYTE_BUDGET_FACTOR` multiplies the byte budget below
  `AUTO_FORCE_LOAD_BP`, and none of the four questions reaches it: it derives
  from no measurement, so there is no "raise past which number"; it is
  single-axis by construction; it never expires; and it does not turn the other
  axis off.
- General rule: a per-axis numeric override needs a defensible answer to *which
  axis*, *how much*, and *for how long*. Where the honest answer to all three is
  "whatever the last rejection happened to report", the feature wants a boolean.

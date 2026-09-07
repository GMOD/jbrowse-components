---
name: folding-content-staleness-into-displayphase
description: Folding content staleness into `displayPhase`
area: rendering-and-displays
---

# Folding content staleness into `displayPhase`

moved here from
`ideas/zoom-perf-followups.md` 2026-08-24, having been costed and never taken.
During a zoom an LGV display reports `ready` for ~600ms between fetches, which
looks like a bug. It is not a stop-token handover artifact — supersede is
gap-free by construction (ADR-080) — it is the fetch autorun's debounce, and
in that window the display genuinely has data covering the viewport with
nothing in flight.

The tempting fix is to fold `isCacheValid` into the per-region
`viewportCurrent`, so a display whose `regionFetchKey` has moved reads
`loading`. **It would raise the loading scrim 250ms into every zoom**, since
`visible = phase === 'loading'`, and delay every interaction-time readiness
gate by the debounce. `zoomInvalidation.test.ts` and
`displayPhaseWiring.test.ts` pin "ready through a zoom inside the buffer" and
are the standing guard against taking this by accident.

The comparative family *does* fold `dataCurrent` in
(`comparativeReadiness.ts`), so the two families genuinely differ — a real
inconsistency, and the LGV reading is the one with the scrim attached to it.
**Reopen only** with a scrim that can distinguish "stale but showing data"
from "nothing to show".

**The EXPORT-gate fold was taken 2026-08-26, and it is not the fold this entry
rejects.** `MultiRegionDisplayMixin` conjoined `isCacheValid` into
`dataCurrent`, whose consumer on this family is `foundationSvgReady`, so an
SVG export of a keyed display stops painting the previous zoom's data across
the debounce plus the RPC. No scrim moved with it, and
`zoomInvalidation.test.ts` and `displayPhaseWiring.test.ts` pin what they
always pinned. Read that conjunct as this entry being reopened and you will
delete a fix; the entry stands for the phase.

**`staleSettingsDrawn` went into the phase 2026-09 and is not this fold
either.** It compares the settings and adapter half of the stamp
(`LoadedRegion.settingsKey`) against `settingsFetchKey`, never the zoom
axis, so it is the scrim the emptied coverage map used to raise on a
settings change — now raised over data still drawn — and stays false on
every zoom. `zoomInvalidation.test.ts` and `displayPhaseWiring.test.ts` pin
what they always pinned.

**`dataSuperseded` went into the phase 2026-08-26 and is likewise not this
fold.** `displayPhase` now takes `viewportWithinLoadedData &&
!dataSuperseded`, because a display that opts into `dataSuperseded` is drawing
its data wrong right now rather than merely about to: zooming alignments'
perBaseLetter from 16 bp/px to 1 keeps the viewport inside the loaded region
while the wall paints a 1 px stripe every 8 px for the whole
debounce-plus-RPC window. That term is false on every display that does not
override it, so it raises no scrim on an ordinary zoom, which is what this
entry is about. **`displayPhase` still must not read `dataCurrent`**, whose
`isCacheValid` term is exactly the 250 ms scrim rejected above — the one-line
edit that spells the argument `dataCurrent` for symmetry with the export gate
takes this fold by accident, and `displayPhaseWiring.test.ts` goes red saying
so.

---
name: discrete-zoom-thresholds-in-rpc-props
description: Three displays answer "which zoom tier am I in" three ways, and two of them put the answer in rpcProps() — so crossing 100 bp/px on canvas's default 'auto' glyph mode, or LGVSyntenyDisplay's LOD tier mid-gesture, fires SettingsInvalidate, which supersedes the fetch and scrims the held data, where a zoomFetchKey term would let it draw unscrimmed until the refetch lands. Moving them carries two riders, and one test in the tree currently claims the opposite.
---

# A discrete zoom threshold is spelled three ways

`MultiRegionDisplayMixin` states the rule: a zoom-dependent worker decision is
the display's `zoomFetchKey` term, not an `rpcProps()` field. Both are axes of
the one `regionFetchKey` now, so either marks every loaded region stale — the
difference is that an `rpcProps` move also runs `SettingsInvalidate`'s
`invalidateSettings()`, which supersedes the in-flight fetch and raises the
`staleSettingsDrawn` scrim over the held data through the refetch, where a key
term lets it draw unscrimmed until the new payload lands. Three displays answer
the same question three ways, and two break that rule:

- canvas's peptide threshold is a `zoomFetchKey` — the rule followed;
- canvas's `effectiveGeneGlyphMode`
  (`plugins/canvas/src/LinearBasicDisplay/model.ts`) is an `rpcProps` field, so
  crossing 100 bp/px on the **default** `'auto'` config fires
  `SettingsInvalidate`, a superseded fetch and the scrim;
- `LGVSyntenyDisplay`'s `lodTier` is an `rpcProps` field read off **live**
  `bpPerPx`, so a zoom gesture crossing the tier fires that supersede and
  scrim mid-gesture.

Moving the last two into their displays' keys carries two riders. The glyph mode
must then ride as a call-site RPC argument, the way the per-base bin does, since
it leaves `rpcProps`. The tier must move to `coarseBpPerPx` in the same edit:
`FetchVisibleRegions` throttles rather than settles, so a live-keyed tier hands
each passing run the tier of a zoom the gesture is only travelling through, and
`LGVSyntenyDisplay` sits on the alignments worker extract — the expensive one.
That opens a debounce window where held data reads current, which is one value
compare in `dataSuperseded`, the shape `LinearAlignmentsDisplay` already uses.

No lint can see "zoom-derived". The enforceable check is a foundation test that
sweeps `bpPerPx` across the known thresholds and asserts `rpcPropsCacheKey` does
not move.

**One test in the tree currently claims otherwise.** Canvas's
`fetchAutorun.test.ts`, "the peptide threshold is the only zoom that refetches",
is false under the default config — its zooms all sit below 100 bp/px, and the
glyph-mode tests use a never-resolving RPC and count nothing.

While editing those two displays, settle on `self.host` for the zoom a key
reads. Four spellings reach the view today — a `getContainingView` cast,
`self.host`, `getView` and `self.view` — and `RegionHost` declares both
`bpPerPx` and `coarseBpPerPx`. Not worth its own commit.

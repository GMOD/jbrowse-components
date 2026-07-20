# Audit: `effective*` resolved getters vs. raw sentinel props

Handoff for an agent auditing the "resolved getter" convention. Self-contained:
you can start from here without prior context.

## The rule (from `CLAUDE.md`)

> A bare getter must return a resolved value, never `undefined`. When a bespoke
> (non-config) MST prop encodes a sentinel (e.g. `rowHeight === 0` =
> fit-to-height), expose the resolved value under a distinct getter
> (`effectiveRowHeight`) and make every consumer — render, SVG export, overlays
> — read that, never the raw prop.

A **sentinel** is a magic in-band value that means "compute the real value":
`rowHeight === 0` → fit rows to height; `minScore === Number.MIN_VALUE` →
autoscale; `resolutionIdx === -1` → no resolution available;
`volatileWidth === undefined` → not yet measured.

## Why it matters (the failure modes you're hunting)

1. **Divide-by-sentinel.** `x / rowHeight` with the raw `0` sentinel yields
   `Infinity`/`NaN`, which then poisons layout, scroll math, and canvas sizes.
2. **Export/overlay drift.** The on-screen renderer resolves the sentinel but
   `renderSvg.tsx` or an overlay reads the raw prop — export silently differs
   from the screen. This is the highest-value class to catch.
3. **Duplicated sentinel logic.** A consumer re-implements
   `raw === 0 ? auto : raw` inline instead of reading the resolved getter. When
   the resolution rule later changes (a cap, a floor), the copies rot.
4. **`undefined`-returning bare getter.** A getter named like a plain value
   returns `undefined`, forcing every caller into `?? fallback` — the undefined
   state the convention exists to eliminate.

## Anatomy — the canonical example (MAF `rowHeight`)

- Config slot `defaultValue: 0`, documented "0 fits rows to display height":
  `plugins/maf/src/LinearMafDisplay/configSchema.ts:42`
- Raw value via `getConf`: `stateModel.ts:208`
- Auto branch: `get autoRowHeight()` `stateModel.ts:712`
- **Resolved getter** `get effectiveRowHeight()` `stateModel.ts:734` —
  `rowHeight === 0 ? autoRowHeight : rowHeight`, then capped by
  `maxRowsHeight / nrow`. Doc comment at `:722` restates "Every consumer reads
  this getter, never the raw `rowHeight`."
- Consumers all read `effectiveRowHeight`: render/tooltip in `stateModel.ts`
  (`:899, :1140, :1287, :1309, :1329, :1353`), export `renderSvg.tsx`
  (`:100, :179, :188, :228`), component `LinearMafDisplayComponent.tsx:253,305`,
  `MAFTooltip.tsx:82`, `resolveRowHover.ts:23`.

That is the shape every entry below should match: **one resolver, every
consumer through it.**

## Known instances (audit baseline — verify each still holds)

`effective*` getters:

| Getter | File:line | Resolves |
| --- | --- | --- |
| `effectiveRowHeight` | `plugins/maf/src/LinearMafDisplay/stateModel.ts:734` | `rowHeight===0` → auto, capped |
| `effectiveRowHeight` | `plugins/variants/src/shared/MultiSampleVariantBaseModel.ts:946` | `rowHeight===0` → auto, floored to 1 |
| `effectiveRowHeight` | `plugins/canvas/src/LinearMultiRowFeatureDisplay/model.ts:411` | alias of resolved `rowHeight` (tree-sidebar iface) |
| `effectiveRowHeight` | `plugins/wiggle/src/MultiLinearWiggleDisplay/model.ts:170` | alias of resolved `rowHeight` |
| `effectiveResolutionIdx` / `effectiveResolution` | `plugins/hic/src/LinearHicDisplay/model.ts:273,290` | `-1` = none; `effectiveResolution` may be `undefined` (guarded by `shouldFetch`) |
| `effectiveShowReverse` / `effectiveShowTranslation` | `plugins/sequence/src/LinearReferenceSequenceDisplay/model.ts:162,169` | gated by `isDna` |
| `effectiveColorBy` | `plugins/linear-comparative-view/src/LinearSyntenyDisplay/model.ts:508` | per-anchor `'reference'` |
| `effectiveLdMetric` / `effectiveLineZoneHeight` | `plugins/variants/src/LDDisplay/shared.ts:281,322` | rpc/conf; mode-dependent |
| `effectiveGeneGlyphMode` | `plugins/canvas/src/LinearBasicDisplay/model.ts:110` | `'auto'` → density |
| `effectiveShowDescriptions` | `plugins/canvas/src/LinearBasicDisplay/baseModel.ts:636` | auto/collapsed gate |
| `effectiveTrackLabels` / `effectiveShowCytobands` | `plugins/linear-genome-view/src/LinearGenomeView/model.ts:517,1500` | session/capability gate |
| `effectiveRpcDriverName` | `packages/core/src/pluggableElementTypes/models/BaseDisplayModel.tsx:148` | own → parent fallback |

Sentinel props resolved under a **shadowing** getter (same name, not `effective*`):

| Sentinel | Raw | Resolved | Consumer reads |
| --- | --- | --- | --- |
| `minScore/maxScore === MIN/MAX_VALUE` = autoscale | `WiggleScoreConfigMixin.ts:145,151` | `minScoreBound`/`maxScoreBound` `:157,164` (→ `undefined` = autoscale) | `WiggleCommonMixin.ts:92` |
| `rowHeightSetting === 0` = auto-fit | `LinearMultiRowFeatureDisplay/model.ts:336` | `get rowHeight()` `:402` | `:697`, `trackMenuItems.ts:55` |
| `resolutionBias` + `autoResolutionIdx === -1` | `LinearHicDisplay/model.ts:253` | `effectiveResolutionIdx` `:273` | via `effectiveResolution` |

The tree-sidebar `TreeDrawingModel` interface **requires** an
`effectiveRowHeight` field (`packages/tree-sidebar/src/types.ts:53`) — that
contract is why maf/variants/canvas/wiggle all expose it. When a model
implements `TreeDrawingModel`, `effectiveRowHeight` is mandatory.

## Audit procedure

1. **Enumerate resolvers.** `git grep -nE 'get effective[A-Z]'` and
   `git grep -nE 'ScoreBound|autoRowHeight|autoResolution'`. Confirm the table
   above is still complete; add new ones.
2. **For each resolver, find the sentinel source** — the config slot
   `defaultValue` or `types.number` prop it reads, and the magic comparison
   (`=== 0`, `=== -1`, `=== Number.MIN_VALUE`, `=== undefined`).
3. **Enumerate raw reads of that prop.** For `rowHeight`:
   `git grep -nE '\b(self|model|state)\.rowHeight\b'` across the owning plugin
   plus its `renderSvg.tsx`, overlay components, tooltip, and virtual-scroll
   helpers. Repeat per sentinel prop.
4. **Classify each raw read** (next section). A raw read that is neither the
   resolver itself nor a legitimate slot-edit is a candidate leak.
5. **Check the resolver never returns `undefined`** unless that `undefined` is
   itself a deliberate downstream signal (autoscale, don't-fetch) — and if so,
   that the comment says so and consumers handle it.

Focus grep on `renderSvg.tsx`, `*Overlay*`, `*Tooltip*`, and files with
`/ rowHeight` or `* rowHeight` arithmetic — those are where drift and
divide-by-zero bite.

## Classifying a raw-prop read

**Legitimate raw read (not a leak) — do not report:**
- The resolver getter itself, and its `auto*` helper.
- Slot/prop **editors**: dialogs and menu items that set or display the raw
  configured value (`SetRowHeightDialog.tsx`, `*MenuItems.ts` radios,
  resize-handle mode checks). Editing the sentinel is the point.
- Arithmetic on the raw prop **guarded** by a mode check (e.g. drag-resize under
  `if (rowHeight > 0)`), fixed-mode only. Verify the guard actually covers the
  division.
- GPU/worker code reading `state.rowHeight` where the model already passed the
  **resolved** value into `state` — trace the assignment before flagging.

**Candidate leak — report it:**
- A renderer, SVG export, overlay, or layout reads the raw prop where a sibling
  path reads the resolved getter.
- Inline re-implementation of the sentinel (`raw === 0 ? … : …`,
  `=== Number.MIN_VALUE ? undefined : …`) instead of calling the existing
  resolver.
- Unguarded `/ rawProp` or `* rawProp` that can hit the sentinel.
- A parameter/interface field named the raw name that is fed the resolved value
  by its only caller — naming invites a future caller to pass the raw sentinel.

## Prior audit pass (resolved — do not re-report)

First audit (2026-07-20) found three items; all triaged. The two fixes landed
in `b2ca0abb26`:

1. **`packages/wiggle-core/src/scoreMenuItems.ts` — FIXED.**
   `resolveScoreBounds` re-implemented the `MIN_VALUE`/`MAX_VALUE` sentinel
   inline instead of reading the resolved bounds. Now reads
   `self.minScoreBound`/`self.maxScoreBound`; `ScoreScaleModel` gained those two
   fields (all four callers already expose them — WiggleScoreConfigMixin +
   alignments' own getters).
2. **`plugins/variants/src/shared/applyRowResizeWheel.ts` — FIXED (rename).**
   The `RowResizeTarget` field was named `rowHeight` (raw name) but divided into;
   renamed to `effectiveRowHeight` across the interface, both divisions, the
   caller (`useVariantVirtualScroll.ts`), and the test. No behavior change — it
   was already fed the resolved value; the rename blocks a future raw-sentinel
   caller.
3. **`plugins/variants/src/shared/MultiSampleVariantBaseModel.ts:672` —
   WON'T-FIX (correct as-is).** `resizeHeight` reads raw `self.rowHeight` to
   distinguish fit-mode (`=== 0`, skip scaling) from pinned-mode (`> 0`, scale
   proportionally). Reading `effectiveRowHeight` here would be the bug — it would
   scale in fit mode and write the resolved auto value back into the pinned slot.
   The division is by `oldAvailableHeight`, separately guarded `> 0`.

## Known intentional exceptions (do NOT report as violations)

- `hic` `effectiveResolution` (`model.ts:290`) returns `undefined` on purpose,
  guarded by `shouldFetch` — the `undefined` means "nothing to fetch."
- Wiggle `minScoreBound`/`maxScoreBound` returning `undefined` is the deliberate
  "autoscale" signal fed to the scale function — not a convention violation.
- `volatileWidth === undefined` (LGV/circular/dotplot) is the standard
  not-yet-measured sentinel; reads are guarded and expected.

## Reporting format

Per finding: `file:line` · sentinel prop · resolved getter that should have been
used · the concrete failure (drift / `NaN` / stale export) · fix vs. won't-fix
with one-line rationale. Group by plugin. Do not fix in the audit pass — hand
back the list.

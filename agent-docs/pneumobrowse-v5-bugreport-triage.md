# PneumoBrowse2 v5.0.0 beta bug report — triage

Source: `~/Downloads/jbrowse2_v5.0.0_bugtest(1).docx` (A.B. Janssen, beta tester).
Reporter config repo: https://github.com/abjanssen/PneumoBrowse2

Reporter environment (from the in-app "About" panel they pasted):

- macOS Sequoia 15.0, Chrome 148, JBrowse served via `npx serve`
- Graphics: **WebGPU** (WebGPU / WebGL2 / Canvas2D available)
- RPC: WebWorkerRpcDriver; cross-origin isolated: **false**; 8 cores; DPR 1
- This is a `webgl-poc` / GPU-refactor build (their About says "JBrowse 4.3.0",
  the doc title says v5.0.0 — same pre-release line).

General sentiment: positive. The GPU refactor "seems to have worked just fine."
Strongly in favor of **scroll-zoom enabled by default** ("works great… would be a
shame to have it behind a button"). No scrollbar artifacts seen on the "auto
height" feature (contra a note from Garrett).

---

## Issue index (by severity)

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Multi-wiggle `defaultRendering: "xyplot"` → MST union error | **High** | **Fixed** (`Core-preProcessTrackConfig` handler in wiggle plugin) |
| 2 | Workspaces (dockview) freeze with many stacked views | **High** | See existing investigation; reporter's bug #1 is the same |
| 3 | Custom `mouseover` jexl callback ignored on GPU feature path | **High** | **Fixed** (`7e576348e8`+`5f14a7f406`; worker reads `mouseover` slot w/ worker jexl) + crash-hardened |
| 4 | GC content track stuck on "loading" | **High** | Adapter OK in jest; GPU wiggle render/stats path suspect — needs browser repro |
| 5 | Two tooltips (glyph + floating name label) | Medium | **Fixed** (`7e576348e8`; glyph+label share `feature.tooltip`) |
| 6 | Gene tooltip now shows "name - description" | Medium | **Fixed** (`7e576348e8`; old `buildFeatureTooltip` concatenation removed) |
| 7 | Cluster-rows-by-score dialog "X" doesn't close | Medium | **Already fixed in HEAD** (`40a74d3634`) |
| 8 | Protein3D plugin `TypeError: …reading 'id'` on launch | Low (external) | External plugin v0.4.10 — out of core scope |
| 9 | Feature-detail table column order changed | Info | Likely intentional (now preserves attribute order) |

---

## 1. Multi-wiggle `defaultRendering: "xyplot"` → MST union error (High)

**Symptom.** Toggling on a single-condition RNA-seq coverage track (e.g.
*Aprianto et al 2016 → WT (0 min)*, `FEVER_VdB_RNA_seq`) throws:

```
Track "FEVER_VdB_RNA_seq" has an invalid configuration:
[mobx-state-tree] No matching type for union (… MultiLinearWiggleDisplayConfigurationSchema …)
for snapshot with type "MultiLinearWiggleDisplay":
  at path "/defaultRendering" value `"xyplot"` is not assignable to type `(JexlString | Rendering)`
  (Value is not a literal "multirowxy" / "multirowdensity" / "multixyplot" / …).
```

"All datasets" works; the reporter's workaround is replacing `xyplot` →
`multxyplot` (i.e. `multixyplot`) in their config.

**Root cause (confirmed in code + their config).** Every transcriptomic track in
PneumoBrowse2 is a `MultiQuantitativeTrack` / `MultiLinearWiggleDisplay`. The
single-condition ones set `defaultRendering: "xyplot"`; the working "all
datasets" track sets `"multiline"`. `MultiLinearWiggleDisplay`'s
`defaultRendering` only accepts the `multi*` literals (`MULTI_WIGGLE_RENDERING_TYPES`).

There **is** a legacy remap for exactly this case —
`plugins/wiggle/src/MultiLinearWiggleDisplay/configSchema.ts:11-16`:

```ts
const SINGLE_TO_MULTI_RENDERING = { xyplot:'multixyplot', density:'multirowdensity', line:'multiline', scatter:'multiscatter' }
```

applied via **`preProcessSnapshot`** (`configSchema.ts:117-124`). The problem:
this snapshot is validated through a **`types.union`** of all display config
schemas at `packages/core/src/util/tracks.ts:508`
(`trackType.configSchema.create(conf, …)` → the track's `displays` union).
**`preProcessSnapshot` does NOT run during union type-dispatch/validation** — MST
validates the *raw* snapshot against each union member, so `"xyplot"` fails the
`types.enumeration(MULTI_WIGGLE_RENDERING_TYPES)` check and the union reports "no
matching type." This is the documented `snapshotProcessor`-vs-`preProcessSnapshot`
gotcha (see memory `key_pattern_snapshotprocessor_vs_preprocesssnapshot`).

`configSchema.test.ts:28-30` passes only because it calls the schema's `.create()`
**directly**, bypassing the union — so the regression is invisible to that test.

Note: the `SINGLE_TO_MULTI_RENDERING` remap was a recent fix attempt
(commit `6a06b418e1`, Jun 17) for exactly this report — but it was wired through
`preProcessSnapshot`, which is the wrong hook for the union path, so it doesn't
take. The reporter explicitly authored `MultiQuantitativeTrack`/
`MultiLinearWiggleDisplay` for single-condition data, so this is **not** a
track-type-misguess — purely the `defaultRendering` remap failing through the
union.

**Fix (done).** The remap now also runs as a `Core-preProcessTrackConfig` handler
registered by the wiggle plugin
(`plugins/wiggle/src/MultiLinearWiggleDisplay/preProcessTrackConfig.ts`), which
fires before union validation (`tracks.ts:504`, `baseTrackConfig.ts:191`). The
remap body is shared with the schema's `preProcessSnapshot` via
`remapMultiWiggleRendering` in `configSchema.ts`. Regression test:
`preProcessTrackConfig.test.ts`. Kept the schema `preProcessSnapshot` as
defense-in-depth for direct creates.

---

## 2. Workspaces (dockview) freeze — and reporter's "can't scroll the genome list"

The reporter actually filed **two symptoms that are one root cause**:

- "When I open localhost I can't scroll the list of genomes / can't reach the
  D39V header. Incognito or another browser works fine."
- "Activating Tools → Use workspaces freezes the list of genomes; deactivating
  makes it normal."

The "list of genomes" is the **vertical stack of many LinearGenomeView panels**
(image1/image2 show ~25 stacked assembly views). On their main browser
`localStorage['useWorkspaces']` is persisted **on** from a prior session, so on
load `ViewsContainer.tsx:35` routes into `TiledViewsContainer` (dockview) and the
page freezes; incognito has no flag → classic container → fine. So bug #1 == bug
#2 == the open investigation in
[`workspaces-freeze-investigation.md`](./workspaces-freeze-investigation.md).

That doc disproved the width-thrash hypothesis but did **not** reproduce the
freeze (it used canvas2d + empty LGVs). Next steps live there; the new data point
from this report is the **scale**: the reporter has ~25 real genome views with
real tracks (CRAM/synteny/wiggle), and freeze is reproducible just by toggling
the flag. See that doc's "virtualize the panel view-stack" lead.

---

## 3. Custom `mouseover` jexl callback ignored on GPU feature path (High)

**Symptom.** Their methylation track config (confirmed in their repo) sets
`"mouseover": "jexl:qvscore(get(feature,'identificationqv'))"`. v4 hover showed
`QV Score: 186` (image9); v5 hover shows just the feature name `m6A` (image10) —
the custom callback is silently ignored and it falls back to the name.

**Hypothesis (from `plugins/canvas` investigation).** Tooltip text is now computed
**in the RPC worker** (`RenderFeatureDataRPC/collectRenderData.ts:163-167`,
`featureTooltip()` → `readConfigValue(config,'mouseover',feature,jexl)`), whereas
the legacy SVG path evaluated `mouseover` on the **main thread**. Two ways this
breaks the reporter's callback:

- **Custom jexl function `qvscore`** is registered by their plugin on the main
  thread but likely **not present in the worker's jexl instance**, so evaluation
  throws and falls back to name.
- The worker-side feature serialization may **drop the `identificationqv`
  attribute**, so `get(feature,'identificationqv')` is `undefined`.

Either way the configured callback produces nothing and the renderer falls back
to name. **To confirm:** check whether plugin-registered jexl functions are
available in the RenderFeatureDataRPC worker, and whether non-standard GFF
attributes survive the worker feature payload. This is the most impactful of the
tooltip changes because it silently breaks user-authored configs.

---

## 4. GC content track stuck on "loading" (High)

**Symptom.** Toggling a GC content track leaves it permanently "loading"
(image8). Their track is `GCContentTrack` → `LinearGCContentTrackDisplay`
(`IndexedFastaAdapter` sequence source). They note they already migrated to the
native GC-content plugin around v4.0.3.

**Findings.** The GC content **adapter logic is fine** — all 13 jest tests in
`plugins/gccontent` pass. GC content renders through the **wiggle GPU path**
(`SharedModelF` composes `linearWiggleDisplayModelFactory`,
`shared.ts:21-28`; `adapterConfig` wraps the sequence adapter in a
`GCContentAdapter`, `shared.ts:111-120`). A permanent "loading" on a wiggle
display almost always means **stats estimation or the render RPC never resolves**,
not an adapter bug. The earlier "generic `BaseSequenceAdapter` cast" theory is a
type-only concern and would not cause a runtime hang — discount it.

**Next step.** Reproduce in-browser on the GPU build with a GC content track and
watch the worker: does `RenderWiggleDataRPC` / the quantitative-stats estimation
complete? `GCContentAdapter` advertises `capabilities = ['hasLocalStats']`
(`GCContentAdapter.ts:17`) — verify the wiggle display's stats path actually calls
into it and gets a result on the GPU branch.

---

## 5. Two tooltips: glyph + floating name label (Medium)

**Symptom.** Previously only the glyph showed a hover box; now both the glyph and
the on-canvas name label produce separate boxes with different info.

**Hypothesis.** In `plugins/canvas/src/LinearBasicDisplay`, both the feature glyph
and the floating label are hit-test targets that call `model.setHover()`
(`FeatureComponent.tsx:260-278` and `:321-327`). The `featureItemMap` builder
(`baseModel.ts:762-780`) prioritizes `SubfeatureInfo` over `FlatbushItem`, but
`SubfeatureInfo` has **no `tooltip` field** (`rpcTypes.ts:162-166`), so the label
hover resolves to a different/empty tooltip source than the glyph. Needs
confirmation; fix is to make the label and glyph resolve the same tooltip (or give
the label no independent tooltip).

## 6. Gene tooltip now "name - description" (Medium)

**Symptom.** Hover on `dnaN` previously showed `dnaN` (image11); now shows
`dnaN - DNA polymerase III beta subunit` (image12). Reporter says config did not
change.

**Hypothesis (needs confirm).** Either the default `mouseover` slot / tooltip
builder now concatenates description, or the name+description floating-label text
is bleeding into the tooltip. Check `BaseLinearDisplay` default `mouseover` slot
(`models/configSchema.ts:47-52`) and the canvas tooltip builder. Lower priority
than #3 but same subsystem — fix together.

## 7. Cluster-rows-by-score dialog "X" doesn't close — ALREADY FIXED

`WiggleClusterDialog.tsx:68-71` only calls `handleClose()` when
`reason !== 'backdropClick'`; the core `Dialog` close button used to report
`'backdropClick'`. Fixed in **`40a74d3634`** (`Dialog.tsx` now reports
`'closeButtonClick'`), present in local HEAD. Confirm it's in the build the
reporter tests next; no further action unless it regressed.

## 8. Protein3D plugin `TypeError: …reading 'id'` (Low — external plugin)

On *mfd* (D39V), the popup correctly resolves the UniProt id (`A0A0H2ZNN6`,
image3), but clicking **Launch** (3D view) throws
`TypeError: Cannot read properties of undefined (reading 'id')`. "Auto-detect
using UniProt ID mapping API" can be clicked but won't select; "Search sequence
against AlphaFoldDB API" reports "No UniProt ID found" via MD5 even though the
feature has one (image4). This is the external **Protein3D plugin v0.4.10**, not
core — refer upstream (jbrowse-plugin-protein3d), but worth a heads-up since the
1D view works and only the 3D launch path breaks.

## 9. Feature-detail table column order changed (Info — likely intentional)

v4.2.0 showed columns alphabetized (Genome, Locus tag — image5); v5.0.0 preserves
the GFF/JSON attribute order (Locus tag, Genome — image6). No alphabetical sort
remains in `BaseFeatureWidget`. This reads as an **intentional** behavior change
(respect source order). Confirm it's desired; if so, nothing to fix.

---
id: heightmodemixin
title: HeightModeMixin
sidebar_label: Mixin -> HeightModeMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/HeightModeMixin.ts).

#crossCuttingMixin Track-height strategy; the one row that must compose
**after** `TrackHeightMixin()`, whose `height` and `resizeHeight` it overrides.
`growTargetHeight` (default = the raw slot). Brings
`heightMode`/`autoHeight`/`fitHeightToDisplay`, `grownHeight`, the reactive
`height` override, `setHeightMode`, and the grow-aware `resizeHeight`

The whole track-height strategy every display with a promotable `heightMode`
config slot shares (the canvas feature display, the alignments display), so the
fixed/grow/fit vocabulary is identical by construction rather than by two call
sites that happen to agree. What differs between the two — canvas fits a feature
stack, alignments a grouped pileup — is exactly one getter, `growTargetHeight`.

`heightMode` is the single source of truth (resolved through the promotable
session-default cascade); `autoHeight`/`fitHeightToDisplay` are plain-flag
conveniences derived from it. `fitTargetHeight` is the raw drag-resizable
`height` slot, read by the fit/grow layout machinery INSTEAD of the reactive
`height` getter: in grow mode `height` returns the content-derived grown height,
so routing the layout through it would make that height depend on itself (a MobX
computed cycle). In fixed/fit mode `fitTargetHeight` equals `height`.

**Grow mode lives here in full.** A display supplies one getter —
`growTargetHeight`, the height its laid-out content wants — and gets
`grownHeight` (that, capped at `growMaxHeight`), the reactive `height` override,
the drag-resize that leaves grow first, and the `setHeightMode` base. Both users
previously carried character-identical copies of the last three, comments
included.

Must be composed **after** `TrackHeightMixin`: it overrides that mixin's
`height` getter and `resizeHeight` action, and `types.compose` resolves a
collision to the later argument. `no-restricted-syntax` fails the wrong order
written in one `types.compose` and says what it costs.

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-heightmode">**heightMode**</span><br><code>"fit" &#124; "fixed" &#124; "grow"</code> | The resolved track-height strategy (`fixed`/`grow`/`fit`). Promotable sentinel slot: resolveConf walks the customized-track -> session-default -> `fixed` cascade and never returns the `inherit` sentinel. |
| <span id="getter-fittargetheight">**fitTargetHeight**</span><br><code>number</code> | The drag-resizable track height as stored in the config slot — the fit target the fit/grow layout scales or packs content into. Read there instead of the reactive `height` getter to break the grow-mode cycle (`height`->grownHeight->layout->height). Equals `height` in fixed/fit. |
| <span id="getter-growmaxheight">**growMaxHeight**</span><br><code>number</code> | Ceiling `grow` mode sizes the track to, in px (content past it scrolls). Lives here rather than as a constant so a track whose whole point is a deep pileup can raise it; both displays that own a `grownHeight` read this, so the two can't diverge. |
| <span id="getter-autoheight">**autoHeight**</span><br><code>boolean</code> | `grow` mode as a boolean, derived from the unified `heightMode` slot. |
| <span id="getter-fitheighttodisplay">**fitHeightToDisplay**</span><br><code>boolean</code> | `fit` mode as a boolean, derived from the unified `heightMode` slot. |
| <span id="getter-growtargetheight">**growTargetHeight**</span><br><code>number</code> | Overridable hook: the height this display's laid-out content wants, in px, before the `growMaxHeight` cap. Canvas answers with its settled feature stack, alignments with its stacked-sections height. The default is the raw slot, so a display that composes this without answering just behaves as if it were fixed.<br><br>**It must not read the reactive `height` getter**, directly or through a layout that does — in grow mode `height` returns `grownHeight`, so that is a MobX computed cycle. Read `fitTargetHeight`/`growMaxHeight` instead; both users do, and say so. |
| <span id="getter-grownheight">**grownHeight**</span><br><code>number</code> | Target track height for `grow`: what the content wants, capped so a deep stack doesn't grow the track to thousands of px (the remainder scrolls). What `installGrowExitBake` bakes into the slot on exit. |
| <span id="getter-height">**height**</span><br><code>number</code> | In grow mode the track height follows the laid-out content reactively — no autorun writes the height config slot, so a settled relayout never churns the persisted session nor bakes a momentary height. Fixed/fit read the slot (fit shrinks content to fill it).<br><br>Guarded on `view.initialized`: `growTargetHeight` transitively reads view-geometry getters that throw before the view is measured, and unlike an autorun (whose MobX error boundary would swallow the pre-init throw) a getter propagates it into render/hydration. Overrides `TrackHeightMixin.height`. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setheightmode">**setHeightMode**</span><br><code>(mode: "fit" &#124; "fixed" &#124; "grow") =&gt; void</code> | Set the track-height strategy by writing the unified `heightMode` slot; the modes are mutually exclusive by construction. Entering a non-`fixed` mode drops a leftover scroll offset that the reconfigured height contradicts — neither fit nor grow generally scrolls, and a sticky canvas left at an out-of-range offset paints clipped or blank with no DOM scroll event to resync it. Displays with more transient state to reset super-capture this. |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> | Drag-resize. A manual drag means the user wants a fixed height, so leave grow first — otherwise the reactive `height` getter re-derives `grownHeight` on the next relayout and the drag appears to do nothing. The displayed (grown) height is read *before* the flip and written as `displayed + distance`, which is also why `installGrowExitBake` skips when the slot moved during the exit: re-baking would clobber this delta. Overrides `TrackHeightMixin.resizeHeight`. |

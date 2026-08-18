---
id: trackheightmixin
title: TrackHeightMixin
sidebar_label: Mixin -> TrackHeightMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/TrackHeightMixin.tsx).

#crossCuttingMixin Internal vertical scroll. `scrollableHeight` (default
`Infinity` = doesn't scroll). Brings the clamped `setScrollTop` and the autorun
that re-clamps when content shrinks

The display height is stored directly on the `height` config slot (drag-resize
writes it via `setSlot`), so it survives a track being unticked and reticked —
the config node outlives the ephemeral display instance. Displays with an
auto-fit mode declare `height` as a `maybeNumber` slot (default `undefined`) and
override the `height` getter to fall back to their computed content height when
unset.

It also owns the **internal vertical scroll** every canvas display that scrolls
its own content shares: the `scrollTop` volatile, a `setScrollTop` clamped
against the overridable `scrollableHeight` hook, and the autorun that re-clamps
when the content shrinks. Four displays (alignments, canvas, MAF, multi-sample
variants) each carried their own copy of the last two, with four copies of the
same "a virtual-scrolled canvas has no overflow container to self-correct"
paragraph; a display now opts into all of it by overriding one getter.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-scrolltop">**scrollTop**</span><br><code>scrollTop: 0</code> |  |
| <span id="volatile-resizing">**resizing**</span><br><code>resizing: false</code> | True for the duration of a height drag, set by the track container's resize handle. A display whose row geometry is a function of the track height restretches every row per animation frame, and can use this to sit an expensive per-frame layer out of the drag (MAF's dense per-base letter overlay is a Canvas2D pass that scales with rows x columns).<br><br>Lives here rather than per display because the handle that knows the drag has started is the shared one next to `resizeHeight`. Displays with their own handles (MAF's band handles) set it directly. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-height">**height**</span><br><code>number</code> |  |
| <span id="getter-scrollableheight">**scrollableHeight**</span><br><code>number</code> | Overridable hook: how far this display's content can scroll past its viewport, in px. `Infinity` (the default) means "this display doesn't scroll internally" — `setScrollTop` then never clamps and the re-clamp autorun below is inert, so a non-scrolling display pays nothing and, crucially, never evaluates a getter that would read view geometry.<br><br>A display that scrolls a canvas overrides this with `max(0, contentHeight - viewportHeight)`, and gets the clamped setter plus the shrink autorun for free. It is the single "does it scroll, and by how much" answer: the wheel handler (`useVirtualScrollWheel`) and `VerticalScrollbar` read the same getter. |
| <span id="getter-supportsheightmodes">**supportsHeightModes**</span><br><code>boolean</code> | Whether this display offers the fixed/grow/fit vocabulary at all, or only the drag-resizable `height` slot above. False here; `HeightModeMixin` overrides it to true, and `types.compose` resolves the collision to the later argument — which is exactly what makes it a usable compose-order probe, the same way `measuresBytesInFetch` is for the canvas size gate.<br><br>That probe is the point. `HeightModeMixin` also overrides `height` and `resizeHeight`, and composing it FIRST silently hands both back to this mixin: grow mode stops working with no error anywhere, and the two `height` getters agree in fixed mode, so no *value* can tell the orders apart. A flag that differs by construction can. Read back in `HeightModeMixin`'s `afterAttach`. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setscrolltop">**setScrollTop**</span><br><code>(scrollTop: number) =&gt; void</code> | Clamped into `[0, scrollableHeight]`, so no caller has to remember the bound. Unbounded for a display that leaves `scrollableHeight` at its `Infinity` default. |
| <span id="action-setresizing">**setResizing**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setheight">**setHeight**</span><br><code>(displayHeight: number) =&gt; number</code> |  |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> |  |
| <span id="action-expandtocontentheight">**expandToContentHeight**</span><br><code>() =&gt; number</code> | Grow the track by exactly the content it is currently hiding, so a display scrolled over a taller stack ends up showing all of it. The track's resize handle runs this on a double click.<br><br>`scrollableHeight` is the whole measurement — it is already every scrolling display's answer to "how much is off the bottom", so no display has to supply a second one. A display that doesn't scroll internally leaves it at `Infinity` and gets a no-op, as does one already showing everything (0).<br><br>Routed through `resizeHeight` rather than `setHeight` so grow mode's override still gets to leave grow first; going straight to the slot would let the reactive height re-derive `grownHeight` and the double click would appear to do nothing. |

---
id: trackheightmixin
title: TrackHeightMixin
sidebar_label: Mixin -> TrackHeightMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/TrackHeightMixin.tsx).

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

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-height">**height**</span><br><code>number</code> |  |
| <span id="getter-resizing">**resizing**</span><br><code>boolean</code> | True for the duration of a height drag on this track, whichever handle is running it. A display whose row geometry is a function of the track height restretches every row per animation frame, and can use this to sit an expensive per-frame layer out of the drag (MAF's dense per-base letter overlay is a Canvas2D pass that scales with rows x columns).<br><br>The flag itself is the track's (`BaseTrackModel`), so the view brackets a drag without needing the active display to have opted into this mixin. Reading it here is what makes `self.resizing` available to a display that did. |
| <span id="getter-scrollableheight">**scrollableHeight**</span><br><code>number</code> | Overridable hook: how far this display's content can scroll past its viewport, in px. `Infinity` (the default) means "this display doesn't scroll internally" — `setScrollTop` then never clamps and the re-clamp autorun below is inert, so a non-scrolling display pays nothing and, crucially, never evaluates a getter that would read view geometry.<br><br>A display that scrolls a canvas overrides this with `max(0, contentHeight - viewportHeight)`, and gets the clamped setter plus the shrink autorun for free. It is the single "does it scroll, and by how much" answer: the wheel handler (`useVirtualScrollWheel`) and `VerticalScrollbar` read the same getter. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setscrolltop">**setScrollTop**</span><br><code>(scrollTop: number) =&gt; void</code> | Clamped into `[0, scrollableHeight]`, so no caller has to remember the bound. Unbounded for a display that leaves `scrollableHeight` at its `Infinity` default. |
| <span id="action-setheight">**setHeight**</span><br><code>(displayHeight: number) =&gt; number</code> |  |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> |  |
| <span id="action-expandtocontentheight">**expandToContentHeight**</span><br><code>() =&gt; number</code> | Grow the track by exactly the content it is currently hiding, so a display scrolled over a taller stack ends up showing all of it. The track's resize handle runs this on a double click.<br><br>`scrollableHeight` is the whole measurement — it is already every scrolling display's answer to "how much is off the bottom", so no display has to supply a second one. A display that doesn't scroll internally leaves it at `Infinity` and gets a no-op, as does one already showing everything (0).<br><br>Routed through `resizeHeight` rather than `setHeight` so grow mode's override still gets to leave grow first; going straight to the slot would let the reactive height re-derive `grownHeight` and the double click would appear to do nothing. |

---
id: trackheightmixin
title: TrackHeightMixin
sidebar_label: Mixin -> TrackHeightMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/TrackHeightMixin.tsx).

#crossCuttingMixin Internal vertical scroll. `scrollContentHeight` and `scrollViewportHeight` (both default 0 = doesn't scroll). Brings the derived `scrollableHeight`, the clamped `setScrollTop` and the autorun that re-clamps when content shrinks

The display height lives on the `height` config slot, so it survives a track
being unticked and reticked. Displays with an auto-fit mode override the
`height` getter.

It also owns the **internal vertical scroll** of every display that paints a
fixed canvas at `-scrollTop`: a display overrides the two height hooks, and
passes itself to `ScrollChrome` and the wheel hooks.

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
| <span id="getter-scrollcontentheight">**scrollContentHeight**</span><br><code>number</code> | Overridable hook: the height of the content that scrolls, in px. |
| <span id="getter-scrollviewportheight">**scrollViewportHeight**</span><br><code>number</code> | Overridable hook: the height of the window it scrolls behind, in px. |
| <span id="getter-scrollableheight">**scrollableHeight**</span><br><code>number</code> | How far the content scrolls. A sub-pixel overflow is 0: a fit mode that divides the viewport across n rows multiplies back to a few ULPs over it, and an extent of 1e-14px still draws a scrollbar and holds the wheel away from the page. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setscrolltop">**setScrollTop**</span><br><code>(scrollTop: number) =&gt; void</code> |  |
| <span id="action-setheight">**setHeight**</span><br><code>(displayHeight: number) =&gt; number</code> |  |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> |  |
| <span id="action-expandtocontentheight">**expandToContentHeight**</span><br><code>() =&gt; number</code> | Grow the track by the content it is hiding, for the resize handle's double click. Goes through `resizeHeight` so grow mode's override leaves grow first. |

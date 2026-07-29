---
id: trackheightmixin
title: TrackHeightMixin
sidebar_label: Mixin -> TrackHeightMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/TrackHeightMixin.tsx).

The display height is stored directly on the `height` config slot (drag-resize
writes it via `setSlot`), so it survives a track being unticked and reticked —
the config node outlives the ephemeral display instance. Displays with an
auto-fit mode declare `height` as a `maybeNumber` slot (default `undefined`) and
override the `height` getter to fall back to their computed content height when
unset.

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

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setscrolltop">**setScrollTop**</span><br><code>(scrollTop: number) =&gt; void</code> |  |
| <span id="action-setheight">**setHeight**</span><br><code>(displayHeight: number) =&gt; number</code> |  |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> |  |

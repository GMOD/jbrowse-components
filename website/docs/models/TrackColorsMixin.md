---
id: trackcolorsmixin
title: TrackColorsMixin
sidebar_label: Mixin -> TrackColorsMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/TrackColorsMixin.ts).

The color-by state shared by every view that can draw more than one synteny
track at once: the view-wide mode, the per-track overrides, and the palette that
tells overlaid tracks apart.

A view supplies only `colorableTrackConfigs` — the dotplot walks its flat
`tracks`, a linear synteny view flattens `levels`. Everything downstream of that
list (palette assignment, mode resolution, legend rows) is identical, so it
lives here rather than being copied into both models.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-colorby">**colorBy**</span><br><code>colorBy: types.stripDefault(types.string, 'default')</code> | The color-by mode the whole view renders with, unless a track overrides it in `trackColorBy`. |
| <span id="property-trackcolorby">**trackColorBy**</span><br><code>trackColorBy: types.map(types.string)</code> | trackId -> color-by mode for that track alone. Absent means the track follows the view-wide `colorBy`. |
| <span id="property-trackcolors">**trackColors**</span><br><code>trackColors: types.map(types.string)</code> | trackId -> explicit color under `colorBy: 'track'`. Absent means the track takes an automatic slot from the palette. |
| <span id="property-showcolorlegend">**showColorLegend**</span><br><code>showColorLegend: types.stripDefault(types.boolean, false)</code> | Show the floating color-by legend. Dismissible via the legend's close button; re-enable from the color-by (palette) menu. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-colorabletracks">**colorableTracks**</span><br><code>ColorableTrack[]</code> | `colorableTrackConfigs` paired with whatever color the user pinned. This is the single definition of "the tracks that get colors" — the palette, the legend and the palette menu all read it, so they cannot disagree about which tracks are in play. |
| <span id="getter-trackcolorassignments">**trackColorAssignments**</span><br><code>Map&lt;string, string&gt;</code> | trackId -> the color it draws in under `colorBy: 'track'`. Assigned across the whole view rather than per display, so an automatic slot can't duplicate a color pinned on a sibling. |
| <span id="getter-uniformcolorby">**uniformColorBy**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>"track" &#124; "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "referenc…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>"track" &#124; "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "reference" &#124; "identity" &#124; "meanQueryIdentity" &#124; "mappingQuality" &#124; "dnds" &#124; undefined</code></pre></dialog></span> | The mode to report as "the view's mode" — undefined when tracks disagree, so the menu shows nothing checked and the legend says so instead of picking one track's answer for everyone. |
| <span id="getter-colorlegendchips">**colorLegendChips**</span><br><code>ColorChip[]</code> | Legend rows naming the overlaid tracks — non-empty only when they are colored by track, or by different modes. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-colorabletrackconfigs">**colorableTrackConfigs**</span><br><code>() =&gt; { trackId: string; name: string; }[]</code> | The tracks that can take a palette slot, in paint order. Overridden by the composing view; a method rather than a getter because that is the form MST overrides cleanly. |
| <span id="method-resolvecolorby">**resolveColorBy**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string) =&gt; "track" &#124; "default" &#124; "strand" &#124; "query" &#124;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string) =&gt; "track" &#124; "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "reference" &#124; "identity" &#124; "meanQueryIdentity" &#124; "mappingQuality" &#124; "dnds"</code></pre></dialog></span> | The mode one track renders with: its own override, else the view-wide mode. |
| <span id="method-trackcolorfor">**trackColorFor**</span><br><code>(trackId: string) =&gt; string</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setcolorby">**setColorBy**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(value: "track" &#124; "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(value: "track" &#124; "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "reference" &#124; "identity" &#124; "meanQueryIdentity" &#124; "mappingQuality" &#124; "dnds") =&gt; void</code></pre></dialog></span> | Set the view-wide mode. Clears every per-track override, so picking a mode from the top level of the palette menu really does mean "all tracks". |
| <span id="action-settrackcolorby">**setTrackColorBy**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string, value: "track" &#124; "default" &#124; "strand" &#124; "quer…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string, value: "track" &#124; "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "reference" &#124; "identity" &#124; "meanQueryIdentity" &#124; "mappingQuality" &#124; "dnds" &#124; undefined) =&gt; void</code></pre></dialog></span> | Point one track at its own mode, or back at the view-wide one. |
| <span id="action-settrackcolor">**setTrackColor**</span><br><code>(trackId: string, value: string &#124; undefined) =&gt; void</code> | Pin one track's color under `colorBy: 'track'`, or release it back to an automatic palette slot. |
| <span id="action-cleartrackcolorsettings">**clearTrackColorSettings**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setshowcolorlegend">**setShowColorLegend**</span><br><code>(value: boolean) =&gt; void</code> |  |

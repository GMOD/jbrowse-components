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
| <span id="getter-colorableattributes">**colorableAttributes**</span><br><code>string[]</code> | Distinct numeric columns across the overlaid tracks, in first-seen order — two tracks declaring `dn` offer one `dn` mode, not two. `colorableTrackConfigs` paired with whatever color the user pinned. This is the single definition of "the tracks that get colors" — the palette, the legend and the palette menu all read it, so they cannot disagree about which tracks are in play. |
| <span id="getter-colorabletracks">**colorableTracks**</span><br><code>ColorableTrack[]</code> |  |
| <span id="getter-trackcolorassignments">**trackColorAssignments**</span><br><code>Map&lt;string, string&gt;</code> | trackId -> the color it draws in under `colorBy: 'track'`. Assigned across the whole view rather than per display, so an automatic slot can't duplicate a color pinned on a sibling. |
| <span id="getter-uniformcolorby">**uniformColorBy**</span><br><code>SyntenyColorBy &#124; undefined</code> | The mode to report as "the view's mode" — undefined when tracks disagree, so the menu shows nothing checked and the legend says so instead of picking one track's answer for everyone. |
| <span id="getter-colorlegendchips">**colorLegendChips**</span><br><code>ColorChip[]</code> | Legend rows naming the overlaid tracks — non-empty only when they are colored by track, or by different modes. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-colorabletrackconfigs">**colorableTrackConfigs**</span><br><code>() =&gt; { trackId: string; name: string; }[]</code> | The tracks that can take a palette slot, in paint order. Overridden by the composing view; a method rather than a getter because that is the form MST overrides cleanly. |
| <span id="method-colorableattributenames">**colorableAttributeNames**</span><br><code>() =&gt; string[]</code> | Numeric columns the overlaid tracks declare (an ortholog table's `attributeColumns`), each of which the palette menu offers as its own mode. Overridden by the composing view, which is the only thing that can reach the track configs.<br><br>From the CONFIG rather than from loaded data: the menu has to be right before the first fetch, and a track that declares a column carrying no values paints the default color anyway. |
| <span id="method-resolvecolorby">**resolveColorBy**</span><br><code>(trackId: string) =&gt; SyntenyColorBy</code> | The mode one track renders with: its own override, else the view-wide mode. |
| <span id="method-trackcolorfor">**trackColorFor**</span><br><code>(trackId: string) =&gt; string</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setcolorby">**setColorBy**</span><br><code>(value: SyntenyColorBy) =&gt; void</code> | Set the view-wide mode. Clears every per-track override, so picking a mode from the top level of the palette menu really does mean "all tracks". |
| <span id="action-settrackcolorby">**setTrackColorBy**</span><br><code>(trackId: string, value: SyntenyColorBy &#124; undefined) =&gt; void</code> | Point one track at its own mode, or back at the view-wide one. |
| <span id="action-settrackcolor">**setTrackColor**</span><br><code>(trackId: string, value: string &#124; undefined) =&gt; void</code> | Pin one track's color under `colorBy: 'track'`, or release it back to an automatic palette slot. |
| <span id="action-cleartrackcolorsettings">**clearTrackColorSettings**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setshowcolorlegend">**setShowColorLegend**</span><br><code>(value: boolean) =&gt; void</code> |  |

---
id: trackcolorsmixin
title: TrackColorsMixin
sidebar_label: Mixin -> TrackColorsMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/TrackColorsMixin.ts).

The color-by state shared by every view that can draw more than one synteny
track at once: the view-wide colour object and the palette that tells overlaid tracks
apart.

A view supplies only `colorableTrackConfigs` — the dotplot walks its flat
`tracks`, a linear synteny view flattens `levels`. Everything downstream of
that list (palette assignment, mode resolution, legend rows) is identical, so
it lives here rather than being copied into both models.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-colorby">**colorBy**</span><br><code>colorBy: syntenyColorConfigSchema</code> | The colour every track in the view paints with, a [](/docs/config/syntenycolor) object: `{ field: "strand" }`, `{ field: "query" }`, `{ field: "reference" }`, `{ field: "track" }`, a measurement (`identity`, `mappingQual`, `dnds`) or a column the tracks declare, with `domain` ordering a text column's labels; a colour string paints every alignment. Unset, the default scheme paints. |
| <span id="property-trackcolors">**trackColors**</span><br><code>trackColors: types.map(types.string)</code> | trackId -> explicit color under `colorBy: { field: 'track' }`. Absent means the track takes an automatic slot from the palette. |
| <span id="property-hideunlabelled">**hideUnlabelled**</span><br><code>hideUnlabelled: types.stripDefault(types.boolean, false)</code> | Under a text-column mode, draw only the rows that carry a label. |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-colorlegenddismissedfor">**colorLegendDismissedFor**</span><br><code>colorLegendDismissedFor: undefined as string &#124; undefined</code> | The field whose legend the reader closed. The legend comes back with the next field that has one, so a dismissal is scoped to the field it was made in rather than being a setting to find again. |
| <span id="volatile-seenattributeranges">**seenAttributeRanges**</span><br><code>seenAttributeRanges: {} as Record&lt;string, AttributeRange&gt;</code> | The widest span each numeric channel has been seen to cover, over every fetch this view has taken — what keeps a column's ramp from re-scaling under a pan. Widened by `observeAttributeRanges`, dropped by `resetAttributeRanges`, read through `attributeRanges`, which is where the reasoning is. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-colorbysetting">**colorBySetting**</span><br><code>SyntenyColorSnapshot</code> | The `colorBy` object as its snapshot holds it. |
| <span id="getter-colorbyvalue">**colorByValue**</span><br><code>string &#124; undefined</code> | `colorBy.value`: the colour every alignment paints under the default mode in place of the view's own scheme, or undefined for that scheme. |
| <span id="getter-colordomain">**colorDomain**</span><br><code>readonly string[]</code> | `colorBy.domain`, the order a text column's labels take. |
| <span id="getter-colorableattributes">**colorableAttributes**</span><br><code>string[]</code> | Distinct numeric columns across the overlaid tracks, in first-seen order — two tracks declaring `dn` offer one `dn` mode, not two. |
| <span id="getter-attributeranges">**attributeRanges**</span><br><code>Record&lt;string, AttributeRange&gt;</code> | The span each numeric channel covers: unioned over the loaded displays, and over every fetch this view has already taken (`seenAttributeRanges`). A column has no declared domain, so this is what its ramp scales to, what the legend labels it with, and — since it is the one domain — what the two cannot disagree about.<br><br>MONOTONIC, which is the point. A fetch's payload reports the span of the slice it holds, and that slice is the snapped window: painting straight off it re-maps every feature onto the ramp each time a pan rolls the window over, so a ribbon in the middle of the ramp turns into one at the bottom while the reader is scrolling and its value has not changed. A domain that only ever widens still says what the reader is looking at — the legend prints the actual numbers — and settles instead of oscillating.<br><br>Monotonic UNTIL A MODE IS PICKED, which is the way back: one window holding an outlier would otherwise compress the ramp for the rest of the session, and the union above is over the LOADED spans, so `resetAttributeRanges` rescales to what is on screen there and then.<br><br>View-wide rather than per display because the floating legend is one box for the whole view: two displays scaling the same ramp from different spans would make that one legend lie about one of them. |
| <span id="getter-colorabletracks">**colorableTracks**</span><br><code>ColorableTrack[]</code> | `colorableTrackConfigs` paired with whatever color the user pinned. This is the single definition of "the tracks that get colors" — the palette, the legend and the palette menu all read it, so they cannot disagree about which tracks are in play. |
| <span id="getter-trackcolorassignments">**trackColorAssignments**</span><br><code>Map&lt;string, string&gt;</code> | trackId -> the color it draws in under `colorBy: { field: 'track' }`. Assigned across the whole view rather than per display, so an automatic slot can't duplicate a color pinned on a sibling. |
| <span id="getter-colorbyfield">**colorByField**</span><br><code>string</code> | The field `colorBy` paints by, `''` for the default colour. |
| <span id="getter-haslegendkey">**hasLegendKey**</span><br><code>boolean</code> | Whether the mode has a key worth a box: a track palette, a ramp, a reader-named column, or strand on points. A reversed ribbon twists, but a whole-genome dotplot is mostly dots with no slope to read, so there the colour is the only strand cue and needs its key. |
| <span id="getter-showlegend">**showLegend**</span><br><code>boolean</code> | The legend-host half of `LegendMixin` a view needs: whether the key draws, which is the mode having one and the reader not having closed it in this mode. `ChromeLegend` and `SvgLegend` read it. |
| <span id="getter-colorlegendchips">**colorLegendChips**</span><br><code>ColorChip[]</code> | Legend rows naming the overlaid tracks — one per track with its palette color, however many levels it is on, and only under `colorBy: { field: 'track' }`, since every other mode has a fixed legend of its own. |
| <span id="getter-colorscales">**colorScales**</span><br><code>ColorScale[]</code> | The active mode's key, or none for a mode without one. View-wide rather than per display because the key is one box for the whole view, and the ramp domain it labels is the view's. |
| <span id="getter-legendspec">**legendSpec**</span><br><code>LegendSpec</code> | The key `ChromeLegend` draws on screen and `SvgLegend` in the export. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-colorabletrackconfigs">**colorableTrackConfigs**</span><br><code>() =&gt; { trackId: string; name: string; }[]</code> | The tracks that can take a palette slot, in paint order. Overridden by the composing view; a method rather than a getter because that is the form MST overrides cleanly. |
| <span id="method-colorableattributenames">**colorableAttributeNames**</span><br><code>() =&gt; string[]</code> | Columns the overlaid tracks declare (an ortholog table's `attributeColumns`), each of which the palette menu offers as its own mode, less the reserved `color` column. Overridden by the composing view, which is the only thing that can reach the track configs.<br><br>From the CONFIG rather than from loaded data: the menu has to be right before the first fetch, and a track that declares a column carrying no values paints the default color anyway. |
| <span id="method-loadedattributeranges">**loadedAttributeRanges**</span><br><code>() =&gt; Record&lt;string, AttributeRange&gt;[]</code> | One entry per loaded display: the span each numeric channel actually covered in the data that display fetched. Overridden by the composing view, which is the only thing that can reach the displays.<br><br>From loaded DATA rather than from the config, unlike `colorableAttributeNames` — a column's observed span is not declared anywhere, so nothing before the first fetch can answer it. |
| <span id="method-legendalpha">**legendAlpha**</span><br><code>() =&gt; number</code> | Overridable hook: what the key's chips are composited by. The ribbon views draw at a global alpha over the band's ground; a view that draws opaque leaves it. |
| <span id="method-legendcigarops">**legendCigarOps**</span><br><code>() =&gt; number &#124; undefined</code> | Overridable hook: the indel ops the key lists a chip for, so it names only what the eye can find. `undefined` is the static menu preview; the dotplot draws flat points and never a CIGAR op. |
| <span id="method-colorsurface">**colorSurface**</span><br><code>() =&gt; SyntenyColorSurface</code> | Overridable hook: what draws each alignment, a ribbon with match and indel blocks or one flat point (the dotplot). The key, the menu's help text and which fields key at all read it. |
| <span id="method-offersreferencecolor">**offersReferenceColor**</span><br><code>() =&gt; boolean</code> | Overridable hook: whether the view has a shared reference for the `reference` field to anchor on. It needs a stack of two or more levels; below that it is query or target by another name. |
| <span id="method-trackcolorfor">**trackColorFor**</span><br><code>(trackId: string) =&gt; string</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-observeattributeranges">**observeAttributeRanges**</span><br><code>(ranges: Record&lt;string, AttributeRange&gt;) =&gt; void</code> | Fold one fetch's observed attribute spans into the domain this view paints and labels its ramps with. Called by each display as its fetch lands, because the accumulation has to outlive the payload it came from: the previous window's span is gone from `loadedAttributeRanges` the moment the next one commits. |
| <span id="action-resetattributeranges">**resetAttributeRanges**</span><br><code>() =&gt; void</code> | Forget the accumulated domain, leaving `attributeRanges` reporting what the LOADED fetches cover and nothing else.<br><br>The way back from a monotonic domain, and the only one: a single window holding an outlier widens the ramp for the rest of the session, and `attributeRanges` unions the loaded spans over this, so a reset rescales to what is on screen without waiting for a refetch. Picking a mode is what calls it — the gesture a reader makes when the ramp is telling them nothing is to choose it again. |
| <span id="action-sethideunlabelled">**setHideUnlabelled**</span><br><code>(value: boolean) =&gt; void</code> |  |
| <span id="action-setcolorby">**setColorBy**</span><br><code>(field: string) =&gt; void</code> | Set the field the view paints by over the `colorBy` object (`''` for the default colour), and rescale the ramp, which is the only way back from a domain one outlying window widened. |
| <span id="action-setcolordomain">**setColorDomain**</span><br><code>(domain: string[]) =&gt; void</code> | Declare the order a text column's labels take. The labels listed lead, the rest follow sorted; an empty list gives back the order the fetches found them in. |
| <span id="action-settrackcolor">**setTrackColor**</span><br><code>(trackId: string, value: string &#124; undefined) =&gt; void</code> | Pin one track's color under `colorBy: { field: 'track' }`, or release it back to an automatic palette slot. |
| <span id="action-cleartrackcolors">**clearTrackColors**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setshowlegend">**setShowLegend**</span><br><code>(show: boolean) =&gt; void</code> | The legend host's setter: closing the key hides it for this mode only, so picking another mode brings its key up. |
| <span id="action-dismisslegendsection">**dismissLegendSection**</span><br><code>() =&gt; void</code> | One section is the whole key here. |

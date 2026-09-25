---
id: syntenycolorsmixin
title: SyntenyColorsMixin
sidebar_label: Mixin -> SyntenyColorsMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/SyntenyColorsMixin.ts).

The colour settings every view drawing synteny tracks shares — the linear
synteny view, the dotplot and the circular view: `TrackColorsMixin`'s colour
object and palette, the plot's opacity and the shortest alignment drawn,
over the tracks the view says it draws. A view supplies `syntenyTracks()`
and its opacity default.

Members a composed model contributes are listed here too, so these tables are the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-alpha">**alpha**</span><br><code>alpha: types.stripDefault(types.number, defaultAlpha)</code> | Opacity of every alignment, 0 to 1. The synteny view defaults it low for dense unfiltered hairballs (with minAlignmentLength set, ~0.4 gives stronger colour); the dotplot defaults it opaque. | SyntenyColorsMixin |
| <span id="property-minalignmentlength">**minAlignmentLength**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>minAlignmentLength: types.stripDefault( types.number, DEFAULT_M…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>minAlignmentLength: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.number,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;DEFAULT_MIN_ALIGNMENT_LENGTH,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | Hide alignment blocks shorter than this many bp, which cuts whole-genome hairball noise. | SyntenyColorsMixin |
| <span id="property-color">**color**</span><br><code>color: syntenyColorConfigSchema</code> | <span data-pagefind-ignore>The colour every track in the view paints with, a [](/docs/config/syntenycolor) object: `{ field: "strand" }`, `{ field: "query" }`, `{ field: "reference" }`, `{ field: "track" }`, a measurement (`identity`, `mapq`, `dnds`) or a column the tracks declare, with `domain` ordering a text column's labels; a colour string paints every alignment. Unset, the default scheme paints.</span> | [TrackColorsMixin](../trackcolorsmixin#property-color) |
| <span id="property-trackcolors">**trackColors**</span><br><code>trackColors: types.map(types.string)</code> | <span data-pagefind-ignore>trackId -> explicit color under `color: { field: 'track' }`. Absent means the track takes an automatic slot from the palette.</span> | [TrackColorsMixin](../trackcolorsmixin#property-trackcolors) |
| <span id="property-hideunlabelled">**hideUnlabelled**</span><br><code>hideUnlabelled: types.stripDefault(types.boolean, false)</code> | <span data-pagefind-ignore>Under a text-column mode, draw only the rows that carry a label.</span> | [TrackColorsMixin](../trackcolorsmixin#property-hideunlabelled) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-seenattributeranges">**seenAttributeRanges**</span><br><code>seenAttributeRanges: {} as Record&lt;string, AttributeRange&gt;</code> | <span data-pagefind-ignore>The widest span each numeric channel has been seen to cover, over every fetch this view has taken — what keeps a column's ramp from re-scaling under a pan. Widened by `observeAttributeRanges`, dropped by `resetAttributeRanges`, read through `attributeRanges`, which is where the reasoning is.</span> | [TrackColorsMixin](../trackcolorsmixin#volatile-seenattributeranges) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-defaultalpha">**defaultAlpha**</span><br><code>number</code> | The `alpha` a reset returns to. | SyntenyColorsMixin |
| <span id="getter-colorsetting">**colorSetting**</span><br><code>SyntenyColorSnapshot</code> | <span data-pagefind-ignore>The `color` object as its snapshot holds it.</span> | [TrackColorsMixin](../trackcolorsmixin#getter-colorsetting) |
| <span id="getter-colorvalue">**colorValue**</span><br><code>string &#124; undefined</code> | <span data-pagefind-ignore>`color.value`: the colour every alignment paints under the default mode in place of the view's own scheme, or undefined for that scheme.</span> | [TrackColorsMixin](../trackcolorsmixin#getter-colorvalue) |
| <span id="getter-colordomain">**colorDomain**</span><br><code>readonly string[]</code> | <span data-pagefind-ignore>`color.domain`, the order a text column's labels take.</span> | [TrackColorsMixin](../trackcolorsmixin#getter-colordomain) |
| <span id="getter-colorableattributes">**colorableAttributes**</span><br><code>string[]</code> | <span data-pagefind-ignore>Distinct numeric columns across the overlaid tracks, in first-seen order — two tracks declaring `dn` offer one `dn` mode, not two.</span> | [TrackColorsMixin](../trackcolorsmixin#getter-colorableattributes) |
| <span id="getter-attributeranges">**attributeRanges**</span><br><code>Record&lt;string, AttributeRange&gt;</code> | <span data-pagefind-ignore>The span each numeric channel covers: unioned over the loaded displays, and over every fetch this view has already taken (`seenAttributeRanges`). A column has no declared domain, so this is what its ramp scales to, what the legend labels it with, and — since it is the one domain — what the two cannot disagree about.<br><br>MONOTONIC, which is the point. A fetch's payload reports the span of the slice it holds, and that slice is the snapped window: painting straight off it re-maps every feature onto the ramp each time a pan rolls the window over, so a ribbon in the middle of the ramp turns into one at the bottom while the reader is scrolling and its value has not changed. A domain that only ever widens still says what the reader is looking at — the legend prints the actual numbers — and settles instead of oscillating.<br><br>Monotonic UNTIL A MODE IS PICKED, which is the way back: one window holding an outlier would otherwise compress the ramp for the rest of the session, and the union above is over the LOADED spans, so `resetAttributeRanges` rescales to what is on screen there and then.<br><br>View-wide rather than per display because the floating legend is one box for the whole view: two displays scaling the same ramp from different spans would make that one legend lie about one of them.</span> | [TrackColorsMixin](../trackcolorsmixin#getter-attributeranges) |
| <span id="getter-colorabletracks">**colorableTracks**</span><br><code>ColorableTrack[]</code> | <span data-pagefind-ignore>`colorableTrackConfigs` paired with whatever color the user pinned. This is the single definition of "the tracks that get colors" — the palette, the legend and the palette menu all read it, so they cannot disagree about which tracks are in play.</span> | [TrackColorsMixin](../trackcolorsmixin#getter-colorabletracks) |
| <span id="getter-trackcolorassignments">**trackColorAssignments**</span><br><code>Map&lt;string, string&gt;</code> | <span data-pagefind-ignore>trackId -> the color it draws in under `color: { field: 'track' }`. Assigned across the whole view rather than per display, so an automatic slot can't duplicate a color pinned on a sibling.</span> | [TrackColorsMixin](../trackcolorsmixin#getter-trackcolorassignments) |
| <span id="getter-colorfield">**colorField**</span><br><code>string</code> | <span data-pagefind-ignore>The field `color` paints by, `''` for the default colour.</span> | [TrackColorsMixin](../trackcolorsmixin#getter-colorfield) |
| <span id="getter-haslegendkey">**hasLegendKey**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether the mode has a key worth a box: a track palette, a ramp, a reader-named column, or strand on points. A reversed ribbon twists, but a whole-genome dotplot is mostly dots with no slope to read, so there the colour is the only strand cue and needs its key.</span> | [TrackColorsMixin](../trackcolorsmixin#getter-haslegendkey) |
| <span id="getter-colorlegendchips">**colorLegendChips**</span><br><code>ColorChip[]</code> | <span data-pagefind-ignore>Legend rows naming the overlaid tracks — one per track with its palette color, however many levels it is on, and only under `color: { field: 'track' }`, since every other mode has a fixed legend of its own.</span> | [TrackColorsMixin](../trackcolorsmixin#getter-colorlegendchips) |
| <span id="getter-colorscales">**colorScales**</span><br><code>ColorScale[]</code> | <span data-pagefind-ignore>The active mode's key, or none for a mode without one. View-wide rather than per display because the key is one box for the whole view, and the ramp domain it labels is the view's.</span> | [TrackColorsMixin](../trackcolorsmixin#getter-colorscales) |

## Methods

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="method-syntenytracks">**syntenyTracks**</span><br><code>() =&gt; ComparativeTrackModel[]</code> | Overridable hook: every synteny track in the view, in paint order. | SyntenyColorsMixin |
| <span id="method-colorabletrackconfigs">**colorableTrackConfigs**</span><br><code>() =&gt; { trackId: string; name: string; }[]</code> |  | SyntenyColorsMixin |
| <span id="method-colorableattributenames">**colorableAttributeNames**</span><br><code>() =&gt; string[]</code> | The columns the tracks declare in their adapter's `attributeColumns` (the ortholog-table adapter's slot), one colour mode each. | SyntenyColorsMixin |
| <span id="method-legendalpha">**legendAlpha**</span><br><code>() =&gt; number</code> | The key's chips are composited by the plot's opacity, as the alignments are. | SyntenyColorsMixin |
| <span id="method-loadedattributeranges">**loadedAttributeRanges**</span><br><code>() =&gt; Record&lt;string, AttributeRange&gt;[]</code> | <span data-pagefind-ignore>One entry per loaded display: the span each numeric channel actually covered in the data that display fetched. Overridden by the composing view, which is the only thing that can reach the displays.<br><br>From loaded DATA rather than from the config, unlike `colorableAttributeNames` — a column's observed span is not declared anywhere, so nothing before the first fetch can answer it.</span> | [TrackColorsMixin](../trackcolorsmixin#method-loadedattributeranges) |
| <span id="method-legendcigarops">**legendCigarOps**</span><br><code>() =&gt; number &#124; undefined</code> | <span data-pagefind-ignore>Overridable hook: the indel ops the key lists a chip for, so it names only what the eye can find. `undefined` is the static menu preview; the dotplot draws flat points and never a CIGAR op.</span> | [TrackColorsMixin](../trackcolorsmixin#method-legendcigarops) |
| <span id="method-colorsurface">**colorSurface**</span><br><code>() =&gt; SyntenyColorSurface</code> | <span data-pagefind-ignore>Overridable hook: what draws each alignment, a ribbon with match and indel blocks or one flat point (the dotplot). The key, the menu's help text and which fields key at all read it.</span> | [TrackColorsMixin](../trackcolorsmixin#method-colorsurface) |
| <span id="method-offersreferencecolor">**offersReferenceColor**</span><br><code>() =&gt; boolean</code> | <span data-pagefind-ignore>Overridable hook: whether the view has a shared reference for the `reference` field to anchor on. It needs a stack of two or more levels; below that it is query or target by another name.</span> | [TrackColorsMixin](../trackcolorsmixin#method-offersreferencecolor) |
| <span id="method-trackcolorfor">**trackColorFor**</span><br><code>(trackId: string) =&gt; string</code> |  | [TrackColorsMixin](../trackcolorsmixin#method-trackcolorfor) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setalpha">**setAlpha**</span><br><code>(value: number) =&gt; void</code> |  | SyntenyColorsMixin |
| <span id="action-setminalignmentlength">**setMinAlignmentLength**</span><br><code>(value: number) =&gt; void</code> |  | SyntenyColorsMixin |
| <span id="action-observeattributeranges">**observeAttributeRanges**</span><br><code>(ranges: Record&lt;string, AttributeRange&gt;) =&gt; void</code> | <span data-pagefind-ignore>Fold one fetch's observed attribute spans into the domain this view paints and labels its ramps with. Called by each display as its fetch lands, because the accumulation has to outlive the payload it came from: the previous window's span is gone from `loadedAttributeRanges` the moment the next one commits.</span> | [TrackColorsMixin](../trackcolorsmixin#action-observeattributeranges) |
| <span id="action-resetattributeranges">**resetAttributeRanges**</span><br><code>() =&gt; void</code> | <span data-pagefind-ignore>Forget the accumulated domain, leaving `attributeRanges` reporting what the LOADED fetches cover and nothing else.<br><br>The way back from a monotonic domain, and the only one: a single window holding an outlier widens the ramp for the rest of the session, and `attributeRanges` unions the loaded spans over this, so a reset rescales to what is on screen without waiting for a refetch. Picking a mode is what calls it — the gesture a reader makes when the ramp is telling them nothing is to choose it again.</span> | [TrackColorsMixin](../trackcolorsmixin#action-resetattributeranges) |
| <span id="action-sethideunlabelled">**setHideUnlabelled**</span><br><code>(value: boolean) =&gt; void</code> |  | [TrackColorsMixin](../trackcolorsmixin#action-sethideunlabelled) |
| <span id="action-setcolorfield">**setColorField**</span><br><code>(field: string) =&gt; void</code> | <span data-pagefind-ignore>Set the field the view paints by over the `color` object (`''` for the default colour), and rescale the ramp, which is the only way back from a domain one outlying window widened.</span> | [TrackColorsMixin](../trackcolorsmixin#action-setcolorfield) |
| <span id="action-setcolordomain">**setColorDomain**</span><br><code>(domain: string[]) =&gt; void</code> | <span data-pagefind-ignore>Declare the order a text column's labels take. The labels listed lead, the rest follow sorted; an empty list gives back the order the fetches found them in.</span> | [TrackColorsMixin](../trackcolorsmixin#action-setcolordomain) |
| <span id="action-settrackcolor">**setTrackColor**</span><br><code>(trackId: string, value: string &#124; undefined) =&gt; void</code> | <span data-pagefind-ignore>Pin one track's color under `color: { field: 'track' }`, or release it back to an automatic palette slot.</span> | [TrackColorsMixin](../trackcolorsmixin#action-settrackcolor) |
| <span id="action-cleartrackcolors">**clearTrackColors**</span><br><code>() =&gt; void</code> |  | [TrackColorsMixin](../trackcolorsmixin#action-cleartrackcolors) |

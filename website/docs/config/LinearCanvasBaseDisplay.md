---
id: linearcanvasbasedisplay
title: LinearCanvasBaseDisplay
sidebar_label: Display -> LinearCanvasBaseDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `canvas`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/baseConfigSchema.ts).

base config for canvas-based linear feature displays (pileup-style glyphs)

## Related links

- **Extended by:** [LinearBasicDisplay](../linearbasicdisplay)
- **Extended by:** [LinearVariantDisplay](../linearvariantdisplay)
- **State model:** [runtime API](../../models/linearcanvasbasedisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

`LinearCanvasBaseDisplay` is a shared base schema, not a type you name in a
config. Set these slots on one of the configs under **Extended by** above, each
of which lists them as inherited and shows the shape in its own example. Slot
types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-maxheight">**maxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1200</code> | Clamp in pixels on the content height this display reports (does not limit fixed or fit mode, where taller content scrolls). The autogrow ceiling is growMaxHeight<br>_advanced_ |
| <span id="slot-growmaxheight">**growMaxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>800</code> | Ceiling in pixels for the "autogrow track height" sizing mode; a track with more content than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes. Raising it past maxHeight has no effect, since that clamps the content height first<br>_advanced_ |
| <span id="slot-heightmode">**heightMode**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (fixed, grow, fit) = <code>'fixed'</code> _promotable_ | Track-sizing strategy — how the track responds when there are more features than fit (shared vocabulary with the alignments display, exposed in the "Track sizing" menu). Unset (the default) follows the session-wide default for this display type, falling back to `fixed`; `fixed` keeps a scrollable fixed height, `grow` expands the track to show all features, `fit` squeezes features to fill the current height. Orthogonal to the per-feature size set by `displayMode`. Unifies the former `autoHeight` (grow) + `squeezeToDisplayHeight` (fit) settings. |
| <span id="slot-showlabels">**showLabels**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, nameAndDescription, name, description, none) = <code>'auto'</code> | Which label text is drawn beside each feature: "auto" adapts to zoom, dropping descriptions at maxDescriptionFeatureDensity and names at maxLabelFeatureDensity; "nameAndDescription", "name", "description", and "none" pin a choice at every zoom. Replaces the former showLabels on/off enum + showDescriptions boolean pair |
| <span id="slot-maxlabelfeaturedensity">**maxLabelFeatureDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>MAX_LABEL_FEATURE_DENSITY</code> | In "auto" showLabels mode, hide labels when visible feature density (features/pixel) exceeds this value<br>_advanced_ |
| <span id="slot-maxdescriptionfeaturedensity">**maxDescriptionFeatureDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>MAX_DESCRIPTION_FEATURE_DENSITY</code> | In "auto" showLabels mode, hide descriptions when visible feature density (features/pixel) exceeds this value. Lower than maxLabelFeatureDensity so descriptions drop before names<br>_advanced_ |
| <span id="slot-color">**color**</span><br>`maybeColor` = <code>undefined</code> | the main fill color of each feature (a CSS color, or a jexl expression for per-feature coloring). Unset, a feature's own BED itemRgb paints it if it has one, else goldenrod<br>_callback args:_ `feature` |
| <span id="slot-connectorcolor">**connectorColor**</span><br>`maybeColor` = <code>undefined</code> | color of the connecting/intron lines between feature segments (defaults to the theme text color)<br>_callback args:_ `feature` |
| <span id="slot-utrcolor">**utrColor**</span><br>`maybeColor` = <code>undefined</code> | fill color for UTRs on gene/transcript glyphs. Unset, a feature's own BED itemRgb paints them too (matching UCSC's whole-item coloring), else a contrasting blue<br>_callback args:_ `feature` |
| <span id="slot-outlinecolor">**outlineColor**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>''</code> | outline color for features (empty string = no outline) |
| <span id="slot-featureheight">**featureHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>10</code> | height in pixels of the main body of each feature<br>_callback args:_ `feature` |
| <span id="slot-displaymode">**displayMode**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (normal, compact, superCompact, collapsed) = <code>'normal'</code> _promotable_ | Feature height preset. Unset (the default) follows the session-wide default for this display type, falling back to `normal`; `normal`/`compact`/`superCompact` customize the track explicitly (including customizing `normal` back over a `compact` session default); `collapsed` packs every feature onto a single row with all labels hidden |
| <span id="slot-geneglyphmode">**geneGlyphMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, all, longestCoding) = <code>'auto'</code> | Gene glyph display mode: "auto" switches based on zoom level, "all" shows all transcripts, "longestCoding" shows only the longest coding transcript |
| <span id="slot-subfeaturelabels">**subfeatureLabels**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, below, overlay) = <code>'none'</code> _promotable_ | subfeature label display mode. Unset (the default) follows the session-wide default for this display type, falling back to `none`; `none`/`below`/`overlay` customize the track explicitly |
| <span id="slot-displaydirectionalchevrons">**displayDirectionalChevrons**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>true</code> _promotable_ | Display directional chevrons on intron lines to indicate strand direction. Unset (the default) follows the session-wide default for this display type, falling back to on; an explicit true/false customizes the track (including customizing on over an off session default) |
| <span id="slot-transcripttypes">**transcriptTypes**</span><br>`stringArray` = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>[ 'mRNA', 'transcript', 'primary_transcript', 'V_gene_segment',…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>[&#10;&#160;&#160;&#160;&#160;'mRNA',&#10;&#160;&#160;&#160;&#160;'transcript',&#10;&#160;&#160;&#160;&#160;'primary_transcript',&#10;&#160;&#160;&#160;&#160;'V_gene_segment',&#10;&#160;&#160;&#160;&#160;'C_gene_segment',&#10;&#160;&#160;&#160;&#160;'D_gene_segment',&#10;&#160;&#160;&#160;&#160;'J_gene_segment',&#10;&#160;&#160;]</code></pre></dialog></span> | feature types counted as transcripts for isoform stacking, label spacing, and the gene-only view. It does not decide which glyph is drawn, whether UTRs are implied, or whether a feature can be translated — those are structural (anything with a direct CDS child is a coding transcript), so org-specific and prokaryotic coding types render correctly without being listed here. |
| <span id="slot-containertypes">**containerTypes**</span><br>`stringArray` = <code>['proteoform_orf']</code> | top-level feature types that always stack their children on separate rows. Container detection is otherwise structural — a feature whose children have children of their own stacks anyway — so this is only needed for a type whose children look like leaves but should still each get a row. |
| <span id="slot-subparts">**subParts**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'CDS,UTR,five_prime_UTR,three_prime_UTR'</code> | subparts for a glyph |
| <span id="slot-impliedutrs">**impliedUTRs**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | imply UTRs from exon/CDS differences on transcript glyphs that carry no explicit UTR subfeatures |
| <span id="slot-labelsname">**labels.name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'jexl:get(feature,'name') &#124;&#124; get(feature,'id')'</code> | the primary name of the feature to show<br>_callback args:_ `feature` |
| <span id="slot-labelsdescription">**labels.description**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'note') &#124;&#124; get(feature,'description') &#124;&#124; get(…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'note') &#124;&#124; get(feature,'description') &#124;&#124; get(feature,'function')'</code></pre></dialog></span> | the text description to show<br>_callback args:_ `feature` |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">6 slots</span> |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message, used if byte size estimates are not available<br>_advanced_ |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[`get(feature,'gbkey')!='Src'`]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config |

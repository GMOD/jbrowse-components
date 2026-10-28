---
id: linearfeaturebasedisplay
title: LinearFeatureBaseDisplay
description: "Holds the slots shared by the canvas-drawn linear feature displays, which stack overlapping features in rows (pileup-style glyphs)."
sidebar_label: Display -> LinearFeatureBaseDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `features` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/features/src/LinearBasicDisplay/baseConfigSchema.ts).

Holds the slots shared by the canvas-drawn linear feature displays, which
stack overlapping features in rows (pileup-style glyphs).

## Related links

- **Extended by:** [LinearBasicDisplay](../linearbasicdisplay)
- **Extended by:** [LinearVariantDisplay](../linearvariantdisplay)
- **State model:** [runtime API](../../models/linearfeaturebasedisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

`LinearFeatureBaseDisplay` is a shared base schema, not a type you name in a config. Set these slots on one of the configs under **Extended by** above, each of which lists them as inherited and shows the shape in an example. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-filter">**filter**</span><br><code>fieldPredicateList()</code> | The features the display draws, a list of [](/docs/config/fieldpredicate) entries a feature must all pass: a field of the feature's own (`{ field: "score", gte: 100 }`), a `jexl:` expression that must hold (`"jexl:feature.type == 'gene'"`), or `geneLike`, true for every gene, transcript and RNA type, the `transcripts.types` and `containers.types`, and a top-level CDS. |
| <span id="slot-tooltip">**tooltip**</span><br>[FeatureTooltip](../featuretooltip) | The box hovering a feature opens, a [](/docs/config/featuretooltip) object. |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message<br>_advanced_ |
| <span id="slot-legend">**legend**</span><br>[Legend](../legend) | The display's color key, when it has one: the key an `encoding.color` field derives, or a variant track's consequence-impact / SV-type presets. |
| <span id="slot-encoding">**encoding**</span><br>[FeatureEncoding](../featureencoding) | The channels the features paint through: `encoding.color`, each feature's main fill. |
| <span id="slot-mark">**mark**</span><br>[FeatureMark](../featuremark) | The box each feature draws as, a [](/docs/config/featuremark) object: `{ height: 6 }`. |
| <span id="slot-displaymode">**displayMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (normal, compact, superCompact, collapsed) = <code>'normal'</code> | Feature height preset, `normal` by default; `compact` and `superCompact` shrink the rows, and `collapsed` packs every feature onto a single row with all labels hidden |
| <span id="slot-facet">**facet**</span><br>[SectionFacet](../sectionfacet) | One labelled section of the track per value of a field: `"strand"`, or `{ field, sort }` with the order its sections stack in. |
| <span id="slot-labels">**labels**</span><br>[CanvasFeatureLabels sub-schema](#slot-labelsname) | The text drawn beside each feature, two parts with `show`. |
| <span id="slot-labelsname">**labels.name**</span><br>[FeatureNameLabel](../featurenamelabel) | Each feature's name, a [](/docs/config/featurenamelabel) object. |
| <span id="slot-labelsdescription">**labels.description**</span><br>[FeatureDescriptionLabel](../featuredescriptionlabel) | The line under each name, a [](/docs/config/featuredescriptionlabel) object. |
| <span id="slot-heightmode">**heightMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (fixed, grow, fit) = <code>'fit'</code> | Track-sizing strategy — how the track responds when there are more features than fit (shared vocabulary with the alignments display, exposed in the "Track sizing" menu). `fit` (the default) keeps the track height and gives up descriptions, then isoforms, then names, then squeezes boxes down to 2px, and scrolls only what still overflows; `fixed` keeps a scrollable fixed height; `grow` expands the track to show all features. Orthogonal to the per-feature size set by `displayMode`, which fit never enlarges. |
| <span id="slot-growmaxheight">**growMaxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>800</code> | Ceiling in pixels for the "autogrow track height" sizing mode; a track with more content than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes<br>_advanced_ |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">3 slots</span> |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1000000</code> | bytes a region may fetch before the display asks first; an adapter that sets its own limit overrides this<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |

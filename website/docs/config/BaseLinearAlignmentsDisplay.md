---
id: baselinearalignmentsdisplay
title: BaseLinearAlignmentsDisplay
description: "The slots LinearAlignmentsDisplay and LGVSyntenyDisplay share: the coverage, pileup and read connection bands, and the filter, unit, facet, sort, encoding and legend every band reads."
sidebar_label: Display -> BaseLinearAlignmentsDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/baseConfigSchema.ts).

The slots LinearAlignmentsDisplay and LGVSyntenyDisplay share: the coverage,
pileup and read connection bands, and the `filter`, `unit`, `facet`, `sort`,
`encoding` and `legend` every band reads. LinearAlignmentsDisplay adds the
sashimi band, the `junction` filter fields, `pileup.bases` and
`modifications`, which apply only to reads; a synteny block has no introns,
basecaller tags or qualities.

## Related links

- **Extended by:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Extended by:** [LinearAlignmentsDisplay](../linearalignmentsdisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

`BaseLinearAlignmentsDisplay` is a shared base schema, not a type you name in a config. Set these slots on one of the configs under **Extended by** above, each of which lists them as inherited and shows the shape in an example. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>250</code> | Starting height in pixels for the bands together; heightMode decides what a pileup deeper than this does |
| <span id="slot-unit">**unit**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (read, chain) = <code>'read'</code> | The unit one row draws: a read, or a chain of a read, its mate and its split segments (the "View as pairs" menu row) |
| <span id="slot-filter">**filter**</span><br>[FieldPredicate](../fieldpredicate) | The alignments drawn, a list of [](/docs/config/fieldpredicate) entries every one of which must hold. The read fields run before every band, so coverage counts only the reads they pass: `flags.UNMAP` and the other samtools flag names, `mapq` (MAPQ 255, none reported, passes a floor), `name`, `tags.HP` and any other tag, and the read categories `spliced`, `svSignal`, `alone` and `split`. `junction.reads`, `junction.canonical` (a split junction reads no motif and counts as canonical, so `equal: false` hides it), `junction.class` (`splice` for an N gap, or a split read's `deletion`, `duplication` or `inversion`) and `junction.source` (`gap` or `split`) test the sashimi junctions, and `connection.interchrom`, `connection.offscreen` and `breakpoint.reads` the connections the arcs, the read cloud and the connectors draw.<br><br>A written list merges with the defaults by field: unmapped, QC-failed and duplicate reads out (`flags.UNMAP`, `flags.QCFAIL` and `flags.DUP` `equal: false`), and `junction.reads` and `breakpoint.reads` at least 2. An entry replaces its own field's defaults, and an entry naming a field with no test, such as `{ field: "flags.DUP" }`, only removes them. |
| <span id="slot-facet">**facet**</span><br>[SectionFacet](../sectionfacet) | In-track stacked grouping, one labelled section per value: a read dimension (`strand`, `firstOfPairStrand`, `pairOrientation`, `pairing`, `split`, `spliced`, `svSignal`, `mapq`, `mateRefName`, `mateAssembly`), a tag (`tags.HP`), or any other field. `{ field: "tags.HP", sort: ["2", "1"] }` stacks the listed values first. |
| <span id="slot-collapsesections">**collapseSections**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Only consulted while `facet` is in effect. When set, each section draws as one row instead of a stack, and tint shading shows overlap depth instead of row count — the compact reading for a track with many sections (an all-vs-all synteny track's mate genomes). A section expanded from its label chip opts back out and draws a true stack. Beside `facet` rather than in it, as Vega-Lite keeps `spacing` and `columns` beside its `facet`: `facet` is written whole, so a member there would reset on every pick of another field. |
| <span id="slot-sort">**sort**</span><br>[AlignmentsSort](../alignmentssort) | The pileup's row order by one `field`: a whole-window order (`position`, `length`, `spliced`, `split`, `svSignal`) or a column sort at one base (`{ field: "strand", pos, refName }`). |
| <span id="slot-encoding">**encoding**</span><br>[AlignmentsEncoding](../alignmentsencoding) | The channels the reads paint through: `encoding.color`, the read fill. |
| <span id="slot-legend">**legend**</span><br>[HiddenLegend](../hiddenlegend) | The display's key: `show`, off by default. |
| <span id="slot-coverage">**coverage**</span><br>[CoverageBand](../coverageband) | The coverage histogram band: `show`, `height` (default 45), `encoding.y`, its depth axis, and the `interbase` and `alleles` layers, each with a `filter`; `alleles.filter` floors each allele segment's share of its position's depth, distinct from `pileup.fadeLowFrequency`. The read cloud's insert-size axis is a fixed log scale (`arcBandYScale`) no setting reaches. |
| <span id="slot-pileup">**pileup**</span><br>[Pileup](../pileup) | The stacked reads: `show`, `mark.height` (default 7), `maxLayoutHeight`, and the parts drawn on each read. |
| <span id="slot-readconnections">**readConnections**</span><br>[ReadConnections](../readconnections) | The connections between mates and split segments: `show` (default off), `mark` (`link`, the arcs, or `rule`, the read cloud), `height`, `placement`, `encoding` (`color` and `strokeWidth`) and `ordinaryPairs`; the `connection` and `breakpoint` filter fields filter the connections drawn. |
| <span id="slot-heightmode">**heightMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (fixed, grow, fit) = <code>'fixed'</code> | Track-sizing strategy — how the track responds when there are more reads than fit (the menu sets `fit` from "Read height → Fit to track height" and `grow` from "Advanced → Autogrow track height"). `fixed` (the default) keeps `pileup.mark.height` and scrolls; `grow` expands the track to show every read at that height; `fit` squeezes reads so every uncollapsed section fills the display without scrolling |
| <span id="slot-growmaxheight">**growMaxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>800</code> | Ceiling in pixels for the "autogrow track height" sizing mode; a pileup deeper than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes, and does not limit how much is laid out (see pileup.maxLayoutHeight)<br>_advanced_ |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">2 slots</span> |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1000000</code> | bytes a region may fetch before the display asks first; an adapter that sets its own limit overrides this<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |

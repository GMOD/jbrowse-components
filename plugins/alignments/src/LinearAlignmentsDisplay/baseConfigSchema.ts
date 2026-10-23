import { coverageBandConfigSchema } from '@jbrowse/alignments-core/coverageBandConfigSchema'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { fieldPredicateList } from '@jbrowse/display-kit/fieldPredicateConfigSchema'
import { heightModeConfigSchemaFields } from '@jbrowse/display-kit/heightModeConfigSchemaFields'
import { hiddenLegendConfigSchema } from '@jbrowse/display-kit/hiddenLegendConfigSchema'
import { sectionFacetConfigSchema } from '@jbrowse/display-kit/sectionFacetConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'
import { scalesSchema, valueScaleSchema } from '@jbrowse/wiggle-core'

import { alignmentsEncodingConfigSchema } from './alignmentsEncodingConfigSchema.ts'
import { alignmentsSortConfigSchema } from './alignmentsSortConfigSchema.ts'
import { ALIGNMENTS_UNITS } from './constants.ts'
import { pileupConfigSchema } from './pileupConfigSchema.ts'
import { readConnectionsConfigSchema } from './readConnectionsConfigSchema.ts'
import { liftV4Filter, retiredConfigSpellings } from './retired.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BaseLinearAlignmentsDisplay
 * The slots LinearAlignmentsDisplay and LGVSyntenyDisplay share: the coverage,
 * pileup and read connection bands, and the `filter`, `unit`, `facet`, `sort`,
 * `encoding` and `legend` every band reads. LinearAlignmentsDisplay adds the
 * sashimi band, the `junction` filter fields, `pileup.bases` and
 * `modifications`, which apply only to reads; a synteny block has no introns,
 * basecaller tags or qualities.
 */
export const baseLinearAlignmentsDisplayConfigSchema = ConfigurationSchema(
  'BaseLinearAlignmentsDisplay',
  {
    /**
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: 250,
      description:
        'Starting height in pixels for the bands together; heightMode decides what a pileup deeper than this does',
    },
    // `growMaxHeight` rides along, so both of `HeightModeMixin`'s slots are
    // declared here at once.
    ...heightModeConfigSchemaFields({
      heightMode:
        'Track-sizing strategy — how the track responds when there are more reads than fit (the menu sets `fit` from "Read height → Fit to track height" and `grow` from "Advanced → Autogrow track height"). `fixed` (the default) keeps `pileup.readHeight` and scrolls; `grow` expands the track to show every read at that height; `fit` squeezes reads so every uncollapsed section fills the display without scrolling',
      growMaxHeight:
        'Ceiling in pixels for the "autogrow track height" sizing mode; a pileup deeper than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes, and does not limit how much is laid out (see pileup.maxLayoutHeight)',
    }),
    /**
     * #slot
     */
    unit: {
      type: 'stringEnum',
      model: types.enumeration('AlignmentsUnit', [...ALIGNMENTS_UNITS]),
      defaultValue: 'read',
      // A chain joins by QNAME, never by a BX/MI linked-read barcode.
      description:
        'The unit one row draws: a read, or a chain of a read, its mate and its split segments (the "View as pairs" menu row)',
      plot: true,
    },
    /**
     * #slot
     * The alignments drawn, a list of [](/docs/config/fieldpredicate) entries
     * every one of which must hold. The read fields run before every band,
     * so coverage counts only the reads they pass: `flags.UNMAP` and the
     * other samtools flag names, `mapq` (MAPQ 255, none reported, passes a
     * floor), `name`, `tags.HP` and any other tag, and the read categories
     * `spliced`, `svSignal`, `alone` and `split`. `junction.reads`,
     * `junction.canonical` (a split junction reads no motif and counts as
     * canonical, so `equal: false` hides it), `junction.class` (`splice` for an N gap, or a
     * split read's `deletion`, `duplication` or `inversion`) and
     * `junction.source` (`gap` or `split`) test the sashimi junctions, and
     * `connection.interchrom`, `connection.offscreen` and `breakpoint.reads`
     * the connections the arcs, the read cloud and the connectors draw.
     *
     * A written list merges with the defaults by field: unmapped, QC-failed
     * and duplicate reads out (`flags.UNMAP`, `flags.QCFAIL` and `flags.DUP`
     * `equal: false`), and `junction.reads` and `breakpoint.reads` at least
     * 2. An entry replaces its own field's defaults, and an entry naming a
     * field with no test, such as `{ field: "flags.DUP" }`, only removes
     * them.
     */
    filter: fieldPredicateList(),
    /**
     * #slot facet
     * In-track stacked grouping, one labelled section per value: a read
     * dimension (`strand`, `firstOfPairStrand`, `pairOrientation`, `pairing`,
     * `split`, `spliced`, `svSignal`, `mapq`, `mateRefName`, `mateAssembly`), a tag
     * (`tags.HP`), or any other field. `{ field: "tags.HP", domain: ["2",
     * "1"] }` stacks the listed values first.
     */
    facet: sectionFacetConfigSchema,
    /**
     * #slot
     * Only consulted while `facet` is in effect. When set, each
     * section draws as one row instead of a stack, and tint shading shows
     * overlap depth instead of row count — the compact reading for a track with
     * many sections (an all-vs-all synteny track's mate genomes). A section
     * expanded from its label chip opts back out and draws a true stack.
     * Beside `facet` rather than in it, as Vega-Lite keeps `spacing` and
     * `columns` beside its `facet`: `facet` is written whole, so a member
     * there would reset on every pick of another field.
     */
    collapseSections: {
      type: 'boolean',
      defaultValue: false,
      description:
        'Draw each facet section as a single row rather than a stack',
    },
    /**
     * #slot sort
     * The pileup's row order by one `field`: a whole-window order
     * (`position`, `length`, `spliced`, `split`, `svSignal`) or a column sort
     * at one base (`{ field: "strand", pos, refName }`).
     */
    sort: alignmentsSortConfigSchema,
    /**
     * #slot encoding
     * The channels the reads paint through: `encoding.color`, the read fill.
     */
    encoding: alignmentsEncodingConfigSchema,
    /**
     * #slot scales
     * The coverage band's value scale. The read cloud's insert-size axis is
     * a fixed log scale (`arcBandYScale`) no setting reaches, and the pileup
     * has no value. `symlogConstant` starts at 1 rather than the wiggle
     * family's 0, which makes symlog exactly `log(depth+1)`: the knee sits at
     * one read, the smallest depth there is. `domainQuantile` stays at 1, the
     * deepest base in view; the Coverage axis panel's Clip extreme outliers
     * writes 0.99, which stops the axis at twice the 99th percentile of the
     * covered bins' peaks, and misses a collapsed-repeat pile-up once it
     * covers more than 1% of the view.
     */
    scales: scalesSchema(
      valueScaleSchema({
        symlogConstant: 1,
      }),
    ),
    /**
     * #slot legend
     * The display's key: `show`, off by default.
     */
    legend: hiddenLegendConfigSchema,
    /**
     * #slot coverage
     * The coverage histogram band: `show`, `height` (default 45),
     * `interbase` and `minAlleleFraction`, a flat floor
     * on each allele segment's share of its position's depth, distinct from
     * `pileup.fadeLowFrequency`.
     */
    coverage: coverageBandConfigSchema,
    /**
     * #slot pileup
     * The stacked reads: `show`, `readHeight` (default 7), `maxLayoutHeight`, and
     * the parts drawn on each read.
     */
    pileup: pileupConfigSchema,
    /**
     * #slot readConnections
     * The connections between mates and split segments: `show` (default
     * off), `mark` (`arc` or `cloud`), `height`, `placement`, `encoding`
     * (`color` and `strokeWidth`) and `ordinaryPairs`; the `connection` and
     * `breakpoint` filter fields filter the connections drawn.
     */
    readConnections: readConnectionsConfigSchema,
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: baseLinearDisplayConfigSchema,
    retired: retiredConfigSpellings,
    preProcessSnapshot: liftV4Filter,
  },
)

export type BaseLinearAlignmentsDisplayConfigSchema =
  typeof baseLinearAlignmentsDisplayConfigSchema

export type BaseLinearAlignmentsDisplayConfigModel =
  Instance<BaseLinearAlignmentsDisplayConfigSchema>

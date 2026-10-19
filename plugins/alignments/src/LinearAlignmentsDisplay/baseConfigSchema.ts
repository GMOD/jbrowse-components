import { coverageBandConfigSchema } from '@jbrowse/alignments-core/coverageBandConfigSchema'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { heightModeConfigSchemaFields } from '@jbrowse/display-kit/heightModeConfigSchemaFields'
import { sectionFacetConfigSchema } from '@jbrowse/display-kit/sectionFacetConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'
import { scalesSchema, valueScaleSchema } from '@jbrowse/wiggle-core'

import { alignmentsColorConfigSchema } from './alignmentsColorConfigSchema.ts'
import { alignmentsSortConfigSchema } from './alignmentsSortConfigSchema.ts'
import { baseAlignmentsFilterConfigSchema } from './baseAlignmentsFilterConfigSchema.ts'
import { ALIGNMENTS_UNITS } from './constants.ts'
import { pileupConfigSchema } from './pileupConfigSchema.ts'
import { readConnectionsConfigSchema } from './readConnectionsConfigSchema.ts'
import { retiredConfigSpellings } from './retired.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BaseLinearAlignmentsDisplay
 * The slots LinearAlignmentsDisplay and LGVSyntenyDisplay share: the coverage,
 * pileup and read connection bands, and the `filter`, `unit`, `facet`, `sort`
 * and `color` every band reads. LinearAlignmentsDisplay adds the sashimi band,
 * `filter.junctions`, `baseColor` and `modifications`, which apply only to
 * reads; a synteny block has no introns, basecaller tags or
 * qualities.
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
        'Track-sizing strategy — how the track responds when there are more reads than fit (shared vocabulary with the canvas feature display, exposed in the "Track sizing" menu). `fixed` (the default) keeps `pileup.readHeight` and scrolls; `grow` expands the track to show every read at that height; `fit` squeezes reads so every uncollapsed section fills the display without scrolling',
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
     * Every test the display applies, and every test must hold. The read
     * members (the flag masks, `minMapq`, `readName`, `tags` and the read
     * categories `spliced`, `svSignal`, `alone` and `split`, each `"only"`,
     * `"exclude"` or unset) run before every band, so coverage counts only
     * the reads they pass; by default `flagExclude` drops unmapped,
     * QC-failed and duplicate reads (1540). `connections` tests the
     * connections the arcs, the read cloud and the connectors over the
     * pileup draw.
     */
    filter: baseAlignmentsFilterConfigSchema,
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
     */
    collapseSections: {
      type: 'boolean',
      defaultValue: false,
      description:
        'Draw each facet section as a single row rather than a stack',
    },
    /**
     * #slot sort
     * The pileup's row order: a whole-window order (`position`, `length`, `spliced`, `split`) or a column sort at one base (`{ type: "strand", pos, refName }`).
     */
    sort: alignmentsSortConfigSchema,
    /**
     * #slot color
     * The read fill: `"steelblue"` paints every read, `{ field: "strand" }`
     * a read dimension's own vocabulary and `{ field: "tags.HP" }` a SAM
     * tag.
     */
    color: alignmentsColorConfigSchema,
    /**
     * #slot scales
     * The coverage band's value scale — the one thing on this display drawn
     * against an axis, the pileup has no value and the arcs use
     * `arcBandYScale`. `symlogConstant` starts at 1 rather than the wiggle
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
     * #slot
     */
    showLegend: {
      type: 'boolean',
      description: 'Show the color-scheme legend overlay. Defaults to off',
      defaultValue: false,
    },
    /**
     * #slot coverage
     * The coverage histogram band: `show`, `height` (default 45),
     * `showInterbaseIndicators` and `minAlleleFraction`, a flat floor
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
     * off), `mark` (`arc` or `cloud`), `height`, `placement`, `lineWidth`,
     * `color` and `showOrdinaryPairs`; `filter.connections` filters the
     * connections drawn.
     */
    readConnections: readConnectionsConfigSchema,
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: baseLinearDisplayConfigSchema,
    retired: retiredConfigSpellings,
  },
)

export type BaseLinearAlignmentsDisplayConfigSchema =
  typeof baseLinearAlignmentsDisplayConfigSchema

export type BaseLinearAlignmentsDisplayConfigModel =
  Instance<BaseLinearAlignmentsDisplayConfigSchema>

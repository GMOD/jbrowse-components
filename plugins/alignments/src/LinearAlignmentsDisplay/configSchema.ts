import { coverageBandConfigSchema } from '@jbrowse/alignments-core/coverageBandConfigSchema'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { heightModeConfigSchemaFields } from '@jbrowse/display-kit/heightModeConfigSchemaFields'
import { sectionFacetConfigSchema } from '@jbrowse/display-kit/sectionFacetConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'
import { scalesSchema, valueScaleSchema } from '@jbrowse/wiggle-core'

import { alignmentsBaseColorConfigSchema } from './alignmentsBaseColorConfigSchema.ts'
import { alignmentsColorConfigSchema } from './alignmentsColorConfigSchema.ts'
import { alignmentsModificationsConfigSchema } from './alignmentsModificationsConfigSchema.ts'
import { alignmentsSortConfigSchema } from './alignmentsSortConfigSchema.ts'
import { ALIGNMENTS_UNITS } from './constants.ts'
import { pileupConfigSchema } from './pileupConfigSchema.ts'
import { readConnectionsConfigSchema } from './readConnectionsConfigSchema.ts'
import { readFilterConfigSchema } from './readFilterConfigSchema.ts'
import { retiredConfigSpellings } from './retired.ts'
import { sashimiConfigSchema } from './sashimiConfigSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearAlignmentsDisplay
 * #category display
 * Draws the reads of an `AlignmentsTrack` as a stack of bands: the coverage
 * histogram with the sashimi arcs over it, the read connections, and the
 * pileup. Each band is one object, `coverage`, `sashimi`, `readConnections`
 * and `pileup`, holding whether it draws, its height and its own filter; the
 * settings every band shares, the read `filter`, `unit`, `facet`, `sort` and
 * `color`, sit beside them.
 *
 * #example
 * Minimal BAM track — no display override needed for defaults. See the
 * [alignments track guide](/docs/config_guides/alignments_track) for all
 * adapter and display options:
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'ngs_reads',
 *   name: 'NGS reads',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BamAdapter', uri: 'https://example.com/sample.bam' },
 * }
 * ```
 *
 * #example
 * CRAM colored by CpG methylation (modBAM MM/ML tags). The `displayDefaults`
 * object shorthand applies settings without spelling out the display `type` or
 * `displayId` — equivalent to `displays: [{ type: 'LinearAlignmentsDisplay',
 * displayId: '...', color: ... }]`. See
 * [configuring displays](/docs/config_guides/tracks#configuring-displays):
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'methylation',
 *   name: 'Methylation',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'CramAdapter', uri: 'https://example.com/sample.cram' },
 *   displayDefaults: {
 *     baseColor: { field: 'modifications' },
 *     modifications: { unmodified: 'all' },
 *   },
 * }
 * ```
 *
 * #example
 * Long reads — taller track, soft-clipping shown, split/chimeric reads
 * connected by arcs, each segment colored by its strand against its
 * molecule's:
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'long_reads',
 *   name: 'Long reads',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BamAdapter', uri: 'https://example.com/longreads.bam' },
 *   displayDefaults: {
 *     height: 400,
 *     unit: 'chain',
 *     color: { field: 'pairOrientation' },
 *     pileup: { showSoftClipping: true },
 *     readConnections: { show: true },
 *   },
 * }
 * ```
 *
 * #example
 * RNA-seq — sashimi arcs placed to avoid crossings, labelled with their read
 * counts, dropping junctions under five reads and the non-canonical ones:
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'rnaseq',
 *   name: 'RNA-seq',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BamAdapter', uri: 'https://example.com/rnaseq.bam' },
 *   displayDefaults: {
 *     coverage: { height: 80 },
 *     sashimi: {
 *       placement: 'auto',
 *       showCounts: true,
 *       filter: { minReads: 5, nonCanonical: 'exclude' },
 *     },
 *   },
 * }
 * ```
 */
export default function configSchemaFactory(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearAlignmentsDisplay',
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
          'Ceiling in pixels for the "autogrow track height" sizing mode; a pileup deeper than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes, and does not limit how much is laid out (see pileup.maxHeight)',
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
      },
      /**
       * #slot
       * Every read filter, in one object: the flag masks, a read name, tag
       * filters, and the four read categories. It runs before every band, so
       * coverage counts only the reads it passes.
       *
       * default filter flags is exclude 1540
       * read unmapped (0x4)
       * read fails platform/vendor quality checks (0x200)
       * read is PCR or optical duplicate (0x400)
       *
       * A read category takes `"only"` or `"exclude"`, and is absent when it
       * isn't filtering — `{ "svSignal": "only" }` for the split reads, the
       * SV-size indels and the discordant pairs. `svSignal`, `singletons`,
       * `split` and `spliced`.
       */
      filter: readFilterConfigSchema,
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
       * Only consulted while `facet` is in effect. Collapsing trades each
       * section's stack for one row, with overlap depth carried by the tint
       * shading instead of by row count — the compact reading for a track with
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
       * #slot baseColor
       * The per-base layer drawn over the reads, whatever fills them:
       * `{ field: "modifications" }`, `"bisulfite"`, `"baseQuality"` or
       * `"base"`.
       */
      baseColor: alignmentsBaseColorConfigSchema,
      /**
       * #slot modifications
       * Settings for the `modifications` and `bisulfite` color fields:
       * `threshold` (percent, default 10), `unmodified`,
       * `cytosineContext` and `shownModifications`.
       */
      modifications: alignmentsModificationsConfigSchema,
      /**
       * #slot scales
       * The coverage band's value scale — the one thing on this display drawn
       * against an axis, the pileup having no value and the arcs their own
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
       * `showInterbaseIndicators` and `filter.minAlleleFraction`, a flat floor
       * on each allele segment's share of its position's depth, distinct from
       * `pileup.fadeLowFrequency`.
       */
      coverage: coverageBandConfigSchema,
      /**
       * #slot pileup
       * The stacked reads: `show`, `readHeight` (default 7), `maxHeight`, and
       * the parts drawn on each read.
       */
      pileup: pileupConfigSchema,
      /**
       * #slot sashimi
       * The splice-junction arcs, drawn in the coverage band: `show`,
       * `height`, `placement`, `showCounts` and `filter`.
       */
      sashimi: sashimiConfigSchema,
      /**
       * #slot readConnections
       * The connections between mates and split segments: `show` (default
       * off), `mark` (`arc` or `cloud`), `height`, `placement`, `lineWidth`,
       * `color`, `showOrdinaryPairs` and `filter`.
       */
      readConnections: readConnectionsConfigSchema,
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
      retired: retiredConfigSpellings,
    },
  )
}

export type LinearAlignmentsDisplayConfigSchema = ReturnType<
  typeof configSchemaFactory
>

export type LinearAlignmentsDisplayConfigModel =
  Instance<LinearAlignmentsDisplayConfigSchema>

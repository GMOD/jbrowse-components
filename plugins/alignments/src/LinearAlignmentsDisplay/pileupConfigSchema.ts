import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { pileupBasesConfigSchema } from './alignmentsBaseColorConfigSchema.ts'
import { pileupMismatchesConfigSchema } from './pileupMismatchesConfigSchema.ts'
import { pileupSoftClipsConfigSchema } from './pileupSoftClipsConfigSchema.ts'

/**
 * #config Pileup
 * #category display
 * The alignments display's `pileup` setting: the band of stacked reads, its
 * read height and layout cap, and the parts drawn on each read.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   pileup: { readHeight: 3, softClips: { show: true } },
 * }
 * ```
 */
export const pileupConfigSchema = ConfigurationSchema(
  'Pileup',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description: 'draw the pileup band',
    },
    /**
     * #slot
     * The one compactness setting: the spacing between reads follows from it
     * (`featureSpacingForHeight`), and the Normal, Compact and Super-compact
     * presets (7, 3, 1) and the fit-mode squeeze all write or read it.
     */
    readHeight: {
      type: 'number',
      defaultValue: 7,
      description: 'height of each read in pixels',
    },
    /**
     * #slot
     */
    maxLayoutHeight: {
      type: 'number',
      defaultValue: 6000,
      description:
        "the tallest the pileup's layout grows in pixels; reads past it are not stacked, and coverage still counts them. Not the display's growMaxHeight, which caps how tall the track grows",
      advanced: true,
    },
    /**
     * #slot mismatches
     * How reads differ from the reference: `show`.
     */
    mismatches: pileupMismatchesConfigSchema,
    /**
     * #slot softClips
     * The soft-clipped ends of each read: `show`.
     */
    softClips: pileupSoftClipsConfigSchema,
    /**
     * #slot
     */
    showConnectors: {
      type: 'boolean',
      defaultValue: false,
      description:
        "draw a connector over the pileup from each read to its mate or split segment: a straight line for a normal pair within one displayed region, a curve otherwise. Under unit: 'chain' a link between displayed regions curves either way. The arc and read-cloud band is readConnections",
    },
    /**
     * #slot
     */
    fadeLowBaseQuality: {
      type: 'boolean',
      defaultValue: false,
      description:
        'fade each mismatch base by its Phred base quality: opaque from 50 up, fading linearly below',
    },
    /**
     * #slot
     */
    fadeLowFrequency: {
      type: 'boolean',
      defaultValue: true,
      description:
        'fade each sub-pixel mismatch, insertion, deletion and clip mark by the share of reads at its position that have it: a mark every read has stays opaque, and one under the depth-dependent noise threshold drops to the sub-pixel floor and, past one base per pixel, takes no clicks. Off draws them all at full opacity. The coverage band is not faded (see runCoveragePipeline)',
      advanced: true,
    },
  },
  { closed: true, plot: true },
)

/**
 * #config ReadsPileup
 * #category display
 * LinearAlignmentsDisplay's `pileup`: the [Pileup](../pileup) band with the
 * per-base layer over the reads, `bases`, which a synteny block, having no
 * qualities or basecaller tags, goes without.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   pileup: { bases: { show: true, encoding: { color: 'modifications' } } },
 * }
 * ```
 */
export const readsPileupConfigSchema = ConfigurationSchema(
  'ReadsPileup',
  {
    /**
     * #slot bases
     * The per-base layer: `show` and `encoding.color`.
     */
    bases: pileupBasesConfigSchema,
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: pileupConfigSchema,
    closed: true,
    plot: true,
  },
)

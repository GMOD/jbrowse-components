import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { pileupConnectorsConfigSchema } from './pileupConnectorsConfigSchema.ts'
import { pileupMarkConfigSchema } from './pileupMarkConfigSchema.ts'
import { pileupMismatchesConfigSchema } from './pileupMismatchesConfigSchema.ts'
import { pileupSoftClipsConfigSchema } from './pileupSoftClipsConfigSchema.ts'

/**
 * #config Pileup
 * #category display
 * The alignments display's `pileup` setting: the band of stacked reads, the
 * `mark` each read draws as, the layout cap, and the parts drawn on each read.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   pileup: { mark: { height: 3 }, softClips: { show: true } },
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
     * Only consulted while `facet` is in effect. When set, each section
     * draws as one row instead of a stack, and tint shading shows overlap
     * depth instead of row count: the compact reading for a track with many
     * sections (an all-vs-all synteny track's mate genomes). A section
     * expanded from its label chip opts back out and draws a true stack. On
     * the pileup rather than `facet`, which a share link writing
     * `facet: 'HP'` replaces whole. The Show menu's "Collapse groups to one
     * row" writes it.
     */
    collapsed: {
      type: 'boolean',
      defaultValue: false,
      description:
        'draw each facet section as a single row rather than a stack',
    },
    /**
     * #slot mark
     * The bar each read draws as: `height`.
     */
    mark: pileupMarkConfigSchema,
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
     * How reads differ from the reference: `show`, and `encoding.opacity`,
     * the fade by base quality.
     */
    mismatches: pileupMismatchesConfigSchema,
    /**
     * #slot softClips
     * The soft-clipped ends of each read: `show`.
     */
    softClips: pileupSoftClipsConfigSchema,
    /**
     * #slot connectors
     * Lines over the pileup joining each read to its mate or split segment:
     * `show`.
     */
    connectors: pileupConnectorsConfigSchema,
    /**
     * #slot
     */
    fadeLowFrequency: {
      type: 'boolean',
      defaultValue: true,
      description:
        'fade each sub-pixel mismatch, insertion, deletion and clip mark by the share of reads at its position that have it: a mark every read has stays opaque, and one under the depth-dependent noise threshold drops to the sub-pixel floor and, past one base per pixel, takes no clicks. Off draws them all at full opacity. The coverage band is not faded',
      advanced: true,
    },
  },
  {
    closed: true,
    plot: true,
  },
)

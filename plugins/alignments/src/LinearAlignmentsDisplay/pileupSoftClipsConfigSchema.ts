import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config PileupSoftClips
 * #category display
 * The pileup's `softClips` layer: the bases at each end of a read the aligner
 * soft-clipped, drawn past the aligned span.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', pileup: { softClips: { show: true } } }
 * ```
 */
export const pileupSoftClipsConfigSchema = ConfigurationSchema(
  'PileupSoftClips',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: false,
      description: 'draw the soft-clipped ends of each read',
    },
  },
  { closed: true },
)

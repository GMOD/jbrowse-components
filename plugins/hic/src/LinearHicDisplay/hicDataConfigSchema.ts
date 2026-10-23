import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config HicData
 * #category display
 * What a Hi-C display's fetch reads of the file: `resolution` steps the
 * binsize from the one the zoom picks, and `normalization` is the matrix
 * normalization asked for.
 *
 * #example
 * One binsize finer than the zoom picks, with vanilla coverage:
 * ```json
 * {
 *   "type": "LinearHicDisplay",
 *   "data": { "resolution": 1, "normalization": "VC" }
 * }
 * ```
 */
export const hicDataConfigSchema = ConfigurationSchema(
  'HicData',
  {
    /**
     * #slot
     */
    resolution: {
      type: 'number',
      defaultValue: 0,
      description:
        'binsizes finer than the zoom picks: 1 one finer, -1 one coarser, 0 follows the zoom',
    },
    /**
     * #slot
     */
    normalization: {
      type: 'string',
      defaultValue: 'KR',
      description:
        'preferred matrix normalization (KR, SCALE, VC, VC_SQRT, NONE); a scheme the file lacks falls back to one it has',
    },
  },
  { closed: true },
)

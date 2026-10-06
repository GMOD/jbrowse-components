import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { DEFAULT_REVIEW_KEYMAP } from './commands/keymap.ts'

/**
 * #config VariantReviewPluginConfigSchema
 * #category root
 * Settings for the keyboard-driven variant review a `LinearGenomeView` gains
 * from the "Review variants in this track" menu item, read from
 * `configuration.VariantReviewPlugin`.
 *
 * #example
 * In the top-level `configuration`: a wider window, moving on after each
 * decision, and h/l in place of k/j:
 * ```js
 * {
 *   VariantReviewPlugin: {
 *     reviewSpanBp: 200,
 *     advanceOnDecide: true,
 *     infoFields: ['AF', 'DP', 'SOMATIC'],
 *     shortcuts: { next: 'l', previous: 'h' },
 *   },
 * }
 * ```
 */
const configSchema = ConfigurationSchema('VariantReviewPluginConfigSchema', {
  /**
   * #slot configuration.VariantReviewPlugin.reviewSpanBp
   * the width of the window each candidate is shown in, unless the session
   * sets its own
   */
  reviewSpanBp: {
    type: 'number',
    defaultValue: 100,
  },
  /**
   * #slot configuration.VariantReviewPlugin.maxReviewWindowBp
   * an event wider than this is not shown whole: the view centres on its start
   * at the review span instead
   */
  maxReviewWindowBp: {
    type: 'number',
    defaultValue: 50_000,
  },
  /**
   * #slot configuration.VariantReviewPlugin.autoSortOnNavigate
   * sort every alignments track at the candidate's column on each move
   */
  autoSortOnNavigate: {
    type: 'boolean',
    defaultValue: true,
  },
  /**
   * #slot configuration.VariantReviewPlugin.advanceOnDecide
   * move to the next candidate after accept, reject or flag
   */
  advanceOnDecide: {
    type: 'boolean',
    defaultValue: false,
  },
  /**
   * #slot configuration.VariantReviewPlugin.restoreSortOnExit
   * put each alignments track's sort back the way it was when review stops
   */
  restoreSortOnExit: {
    type: 'boolean',
    defaultValue: true,
  },
  /**
   * #slot configuration.VariantReviewPlugin.targetTrackIds
   * the alignments tracks review sorts; empty means every one in the view
   */
  targetTrackIds: {
    type: 'stringArray',
    defaultValue: [],
  },
  /**
   * #slot configuration.VariantReviewPlugin.infoFields
   * the INFO keys read for each candidate and shown in the review widget
   */
  infoFields: {
    type: 'stringArray',
    defaultValue: ['AF', 'DP'],
  },
  /**
   * #slot configuration.VariantReviewPlugin.maxCandidates
   * the candidate list stops here; a review set is a filtered call set, not a
   * whole-genome VCF
   */
  maxCandidates: {
    type: 'number',
    defaultValue: 50_000,
  },
  /**
   * #slot configuration.VariantReviewPlugin.recordTimestamps
   * store when each decision was made
   */
  recordTimestamps: {
    type: 'boolean',
    defaultValue: false,
  },
  /**
   * #slot configuration.VariantReviewPlugin.shortcuts
   * key bindings by command id, merged over the defaults, e.g.
   * `{ "next": "l", "previous": "h" }`; an empty string unbinds
   */
  shortcuts: {
    type: 'frozen',
    defaultValue: DEFAULT_REVIEW_KEYMAP,
  },
})

export default configSchema

export interface ReviewConfig {
  reviewSpanBp: number
  maxReviewWindowBp: number
  autoSortOnNavigate: boolean
  advanceOnDecide: boolean
  restoreSortOnExit: boolean
  targetTrackIds: string[]
  infoFields: string[]
  maxCandidates: number
  recordTimestamps: boolean
  shortcuts: unknown
}

export const DEFAULT_REVIEW_CONFIG: Readonly<ReviewConfig> = {
  reviewSpanBp: 100,
  maxReviewWindowBp: 50_000,
  autoSortOnNavigate: true,
  advanceOnDecide: false,
  restoreSortOnExit: true,
  targetTrackIds: [],
  infoFields: ['AF', 'DP'],
  maxCandidates: 50_000,
  recordTimestamps: false,
  shortcuts: DEFAULT_REVIEW_KEYMAP,
}

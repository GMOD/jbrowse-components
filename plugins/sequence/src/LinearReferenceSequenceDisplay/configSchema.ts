import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearReferenceSequenceDisplay
 *
 * #example
 * A complete `ReferenceSequenceTrack` config to paste into `tracks` (an
 * assembly's `sequence` track takes the same shape). `showForward`,
 * `showReverse`, and `showTranslation` toggle the strand/translation rows:
 * ```js
 * {
 *   type: 'ReferenceSequenceTrack',
 *   trackId: 'refseq',
 *   name: 'Reference sequence',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'IndexedFastaAdapter',
 *     uri: 'https://example.com/genome.fa',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearReferenceSequenceDisplay',
 *       displayId: 'refseq-LinearReferenceSequenceDisplay',
 *       showTranslation: false,
 *     },
 *   ],
 * }
 * ```
 */

export const configSchema = ConfigurationSchema(
  'LinearReferenceSequenceDisplay',
  {
    /**
     * #slot
     * explicit display height (e.g. from a drag-resize); unset means auto-fit to
     * the zoom-aware computed height. See the model's `height` getter.
     */
    height: {
      type: 'maybeNumber',
      description: 'display height in pixels; unset auto-fits to the sequence',
      defaultValue: undefined,
    },
    /**
     * #slot
     */
    showForward: {
      type: 'boolean',
      defaultValue: true,
      description: 'show the forward-strand sequence row',
    },
    /**
     * #slot
     */
    showReverse: {
      type: 'boolean',
      defaultValue: true,
      description: 'show the reverse-complement sequence row (DNA only)',
    },
    /**
     * #slot
     */
    showTranslation: {
      type: 'boolean',
      defaultValue: true,
      description: 'show the translation frame rows (DNA only)',
    },
  },
  { explicitIdentifier: 'displayId', explicitlyTyped: true },
)

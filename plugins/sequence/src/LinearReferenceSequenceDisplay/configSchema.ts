import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { regionTooLargeConfigSchemaFields } from '@jbrowse/display-kit/regionTooLargeConfigSchemaFields'

/**
 * #config LinearReferenceSequenceDisplay
 *
 * #example
 * The display goes in the `displays` array of the assembly's `sequence` track,
 * which is where a `ReferenceSequenceTrack` is authored — it names no assembly
 * of its own. `showForward`, `showReverse`, and `showTranslation` toggle the
 * strand and translation rows:
 * ```js
 * sequence: {
 *   type: 'ReferenceSequenceTrack',
 *   trackId: 'refseq',
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
    // Owed to `RegionTooLargeMixin`, which this display composes through
    // `MultiRegionDisplayMixin` and which reads both slots through a host cast.
    // This schema stands apart from `baseLinearDisplayConfigSchema` (its
    // `height` is a `maybeNumber` that auto-fits, and none of the feature slots
    // apply to a sequence row), so the pair comes from the mixin's own table.
    ...regionTooLargeConfigSchemaFields,
  },
  { explicitIdentifier: 'displayId', explicitlyTyped: true },
)

export type LinearReferenceSequenceDisplayConfigModel = typeof configSchema

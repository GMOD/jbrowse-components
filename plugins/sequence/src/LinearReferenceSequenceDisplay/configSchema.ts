import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { regionTooLargeConfigSchemaFields } from '@jbrowse/display-kit/regionTooLargeConfigSchemaFields'

/**
 * #config LinearReferenceSequenceDisplay
 * Draws a `ReferenceSequenceTrack` as rows of bases: the forward strand, the
 * reverse complement and the translation frames.
 *
 * #example
 * The display goes in the `displays` array of the assembly's `sequence` track,
 * which is where a `ReferenceSequenceTrack` is authored, so the display sets
 * no assembly name. `forward`, `reverse` and `translation` each turn their rows
 * on and off with `show`:
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
 *       translation: { show: false },
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
     * #slot forward
     * The forward-strand base row.
     */
    forward: ConfigurationSchema(
      'SequenceForward',
      {
        /**
         * #slot forward.show
         */
        show: {
          type: 'boolean',
          defaultValue: true,
          description: 'draw the rows',
        },
      },
      { closed: true },
    ),
    /**
     * #slot reverse
     * The reverse-complement base row; a protein sequence has none.
     */
    reverse: ConfigurationSchema(
      'SequenceReverse',
      {
        /**
         * #slot reverse.show
         */
        show: {
          type: 'boolean',
          defaultValue: true,
          description: 'draw the rows',
        },
      },
      { closed: true },
    ),
    /**
     * #slot translation
     * The three translation frame rows per drawn strand; a protein
     * sequence has none.
     */
    translation: ConfigurationSchema(
      'SequenceTranslation',
      {
        /**
         * #slot translation.show
         */
        show: {
          type: 'boolean',
          defaultValue: true,
          description: 'draw the rows',
        },
      },
      { closed: true },
    ),
    // Owed to `RegionTooLargeMixin`, which this display composes through
    // `MultiRegionDisplayMixin` and which reads both slots through a host cast.
    // This schema stands apart from `baseLinearDisplayConfigSchema` (its
    // `height` is a `maybeNumber` that auto-fits, and none of the feature slots
    // apply to a sequence row), so the pair comes from the mixin's own table.
    ...regionTooLargeConfigSchemaFields,
  },
  {
    explicitIdentifier: 'displayId',
    explicitlyTyped: true,
    // v4's renderer block held the row height
    retired: { renderer: () => ({}) },
  },
)

export type LinearReferenceSequenceDisplayConfigModel = typeof configSchema

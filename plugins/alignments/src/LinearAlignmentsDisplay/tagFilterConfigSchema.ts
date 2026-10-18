import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config TagFilter
 * #category display
 * One tag a read has to carry to pass, with the value it has to hold where
 * one is named. An entry naming no tag tests nothing.
 */
export const tagFilterConfigSchema = ConfigurationSchema(
  'TagFilter',
  {
    /**
     * #slot
     */
    tag: {
      type: 'string',
      defaultValue: '',
      description: 'the SAM tag, HP or RG',
    },
    /**
     * #slot
     */
    value: {
      type: 'maybeString',
      description:
        'the value the tag has to hold; unset passes any read carrying the tag',
    },
  },
  {
    closed: true,
    // v4's dialog asked for `*` to mean "any value", and its empty value
    // kept the reads lacking the tag, which nobody meant: both are unset
    preProcessSnapshot: snap =>
      snap.value === '*' || snap.value === ''
        ? { ...snap, value: undefined }
        : snap,
  },
)

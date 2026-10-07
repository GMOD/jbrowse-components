import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config TagFilter
 * #category display
 * One tag a read has to carry to pass, with the value it has to hold where
 * one is named.
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
  { closed: true },
)

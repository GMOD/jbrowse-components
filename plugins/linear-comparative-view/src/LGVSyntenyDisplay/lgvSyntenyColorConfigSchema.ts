import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { colorChannelOptions } from '@jbrowse/display-kit/colorConfigSchema'
import { alignmentsColorConfigSchema } from '@jbrowse/plugin-alignments'

/**
 * #config LGVSyntenyColor
 * #category display
 * The LGVSyntenyDisplay's `color` setting: the
 * [AlignmentsColor](../alignmentscolor) object with `field` defaulting to
 * `strand`, where the alignments display paints one fill. A string is the
 * constant, `{ value, scale: 'none' }`, so the default field does not hide it.
 *
 * #example
 * ```js
 * { type: 'LGVSyntenyDisplay', color: { field: 'mateRefName' } }
 * ```
 */
export const lgvSyntenyColorConfigSchema = ConfigurationSchema(
  'LGVSyntenyColor',
  {
    /**
     * #slot field
     * `strand`, `mapq` and `mateRefName` (the query contig) are the fields a
     * synteny block answers.
     */
    field: { type: 'string', defaultValue: 'strand' },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: alignmentsColorConfigSchema,
    ...colorChannelOptions('color'),
    shorthandWith: { scale: 'none' },
  },
)

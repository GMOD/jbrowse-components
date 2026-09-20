import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { colorChannelOptions } from '@jbrowse/display-kit/colorConfigSchema'
import { alignmentsColorConfigSchema } from '@jbrowse/plugin-alignments'

/**
 * #config LGVSyntenyColor
 * #category display
 * The LGVSyntenyDisplay's `color` setting: the
 * [AlignmentsColor](../alignmentscolor) object with `field` defaulting to
 * `strand`, where the alignments display paints one fill.
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
  },
)

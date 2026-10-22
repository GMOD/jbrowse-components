import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { colorChannelOptions } from '@jbrowse/display-kit/colorConfigSchema'
import {
  ALIGNMENTS_FIELD_PRESETS,
  alignmentsColorConfigSchema,
} from '@jbrowse/plugin-alignments'

/**
 * The field LGVSyntenyColor maps while it names neither a field nor a
 * constant.
 */
export const LGV_SYNTENY_IMPLIED_FIELD = 'strand'

/**
 * #config LGVSyntenyColor
 * #category display
 * The LGVSyntenyDisplay's `color` setting: the
 * [AlignmentsColor](../alignmentscolor) object, painting `strand` while it
 * names neither a field nor a constant. `strand`, `mapq` and `mateRefName`
 * (the query contig) are the fields a synteny block answers.
 *
 * #example
 * ```js
 * { type: 'LGVSyntenyDisplay', color: { field: 'mateRefName' } }
 * ```
 */
export const lgvSyntenyColorConfigSchema = ConfigurationSchema(
  'LGVSyntenyColor',
  {},
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: alignmentsColorConfigSchema,
    ...colorChannelOptions('color', ALIGNMENTS_FIELD_PRESETS, {
      impliedField: LGV_SYNTENY_IMPLIED_FIELD,
    }),
  },
)

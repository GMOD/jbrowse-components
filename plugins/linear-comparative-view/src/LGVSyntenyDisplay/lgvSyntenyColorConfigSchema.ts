import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  colorChannelOptions,
  encodingOptions,
} from '@jbrowse/display-kit/colorConfigSchema'
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
 * The LGVSyntenyDisplay's `encoding.color`: the
 * [AlignmentsColor](../alignmentscolor) channel, painting `strand` while it
 * names neither a field nor a constant. `strand`, `mapq` and `mateRefName`
 * (the query contig) are the fields a synteny block answers.
 *
 * #example
 * ```js
 * { type: 'LGVSyntenyDisplay', encoding: { color: 'mateRefName' } }
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
    ...colorChannelOptions('encoding.color', ALIGNMENTS_FIELD_PRESETS, {
      impliedField: LGV_SYNTENY_IMPLIED_FIELD,
    }),
  },
)

/**
 * #config LGVSyntenyEncoding
 * #category display
 * The LGVSyntenyDisplay's `encoding`, the channels its blocks paint through.
 *
 * #example
 * ```js
 * { type: 'LGVSyntenyDisplay', encoding: { color: 'mapq' } }
 * ```
 */
export const lgvSyntenyEncodingConfigSchema = ConfigurationSchema(
  'LGVSyntenyEncoding',
  {
    /**
     * #slot color
     * The block fill, `strand` while it names neither a field nor a
     * constant.
     */
    color: lgvSyntenyColorConfigSchema,
  },
  encodingOptions,
)

import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { DEFAULTS } from './displayDefaults.ts'

const mafMarkHeightSchema = ConfigurationSchema(
  'MafAlignmentsMarkHeight',
  {
    /**
     * #slot height.band
     * The fraction of its row a species' glyphs fill, centred in the row, so
     * below 1 the rows stand apart. The track menu's Row height presets write
     * it.
     */
    band: {
      type: 'number',
      defaultValue: DEFAULTS.rowProportion,
      description: 'fraction of its row a glyph fills',
    },
  },
  { closed: true },
)

/**
 * #config MafAlignmentsMark
 * #category display
 * The MAF rows' `mark`, the glyph each aligned base draws as: its `height`,
 * spelled as the mark display's `rect`.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', alignments: { mark: { height: { band: 0.9 } } } }
 * ```
 */
export const mafAlignmentsMarkConfigSchema = ConfigurationSchema(
  'MafAlignmentsMark',
  {
    /**
     * #slot
     * The height a glyph draws at, as a fraction of its row:
     * `{ band: 0.8 }`, Vega-Lite's spelling.
     */
    height: mafMarkHeightSchema,
  },
  { closed: true },
)

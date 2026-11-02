import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { rowArrangementConfigSchema } from '@jbrowse/display-kit/rowArrangementConfigSchema'
import { rowAxisConfigSchema } from '@jbrowse/display-kit/rowAxisConfigSchema'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'

/**
 * #config MafRows
 * #category display
 * The MAF display's `rows`: one per species (or genome) the alignment
 * holds, and a copy row (`mm10~2`) where a block aligns one twice. The
 * object is the [RowArrangement](../rowarrangement) a reader gives the rows,
 * each member by row name, with the colors pinned on rows and an axis with no
 * `grid`, since the species rows keep a gap instead. A row is always a
 * species, so it takes no `field`, and writing it changes only the members
 * stated.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', rows: { sort: ['mm10'], axis: { tree: false } } }
 * ```
 * ```js
 * {
 *   type: 'LinearMafDisplay',
 *   rows: { sort: ['mm10'], labels: { mm10: 'Mouse' }, kept: ['mm10', 'hg38'] },
 * }
 * ```
 */
export const mafRowsConfigSchema = ConfigurationSchema(
  'MafRows',
  {
    /**
     * #slot axis
     * The guide down the left of the species rows, a [RowAxis](../rowaxis):
     * the species tree and each species' name.
     */
    axis: rowAxisConfigSchema,
    /**
     * #slot colors
     * A color pinned on a row, by name, over whatever `rows.color` maps it
     * to, as `labels` pins its text. The arrangement dialog's row swatches
     * write it. A row with none takes `rows.color`, else the adapter's
     * `samples[].color`, else the palette. A copy row takes its species'.
     */
    colors: {
      type: 'stringMap',
      defaultValue: {},
      description:
        "a color pinned on a row, by name, over the color rows.color maps it to; a row with none takes rows.color, else the file's own color",
    },
    /**
     * #slot color
     * The rows colored by an attribute: a [RowColor](../rowcolor) channel,
     * `name` (each row) by default. Per-row colors are `rows.colors`, which
     * win over it.
     */
    color: rowColorConfigSchema,
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: rowArrangementConfigSchema,
    plot: true,
  },
)

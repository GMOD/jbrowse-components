import { coverageBandConfigSchema } from '@jbrowse/alignments-core/coverageBandConfigSchema'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { legendConfigSchema } from '@jbrowse/display-kit/legendConfigSchema'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import { sampleRowsConfigSchema } from '@jbrowse/display-kit/sampleRowsConfigSchema'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'
import { rowHeightConfigSchemaFields } from '@jbrowse/tree-sidebar/rowHeightConfigSchemaFields'
import { treeSidebarConfigSchemaFields } from '@jbrowse/tree-sidebar/treeSidebarConfigSchemaFields'
import { scalesSchema, valueScaleSchema } from '@jbrowse/wiggle-core'

import { DEFAULTS } from './displayDefaults.ts'
import { mafAlignmentsConfigSchema } from './mafAlignmentsConfigSchema.ts'
import { mafConservationConfigSchema } from './mafConservationConfigSchema.ts'
import { mafEncodingConfigSchema } from './mafEncodingConfigSchema.ts'
import { MAF_Y_FIELDS } from './rowRenderings.ts'

import type { RetiredSpelling } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * The v4 mafviewer plugin's row settings, top-level there. Letters now follow
 * `encoding.color` and keep the file's case, so the two letter settings lift
 * to nothing.
 */
const retiredMafSpellings: Record<string, RetiredSpelling> = {
  rowProportion: v => ({ alignments: { rowProportion: v } }),
  showAllLetters: () => ({}),
  showAsUpperCase: () => ({}),
}

/**
 * #config LinearMafDisplay
 * #category display
 * The display for a `MafTrack`: one row per aligned species, with a
 * conservation summary above them. The slots are show/hide defaults and band
 * sizes; the bands and overlays derive from the alignment and toggle from the
 * track menu.
 *
 * #example
 * Set through the track's `displayDefaults`, so the track opens in this state
 * for every viewer.
 * ```js
 * {
 *   type: 'MafTrack',
 *   trackId: 'multiz_example',
 *   name: 'Multiz alignment',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'BigMafAdapter',
 *     bigBedLocation: { uri: 'https://example.com/multiz.bb' },
 *     samples: ['hg38', 'panTro6', 'rheMac10', 'mm39'],
 *   },
 *   displayDefaults: {
 *     rowHeight: 12,
 *     conservation: { show: true, height: 40 },
 *     showRowLabels: true,
 *   },
 * }
 * ```
 */
export default function configSchemaF() {
  // The CDS-frame source is a sub-adapter on the MAF adapter
  // (`framesAdapter`), not a display slot.
  return ConfigurationSchema(
    'LinearMafDisplay',
    {
      /**
       * #slot
       * The whole budget the byte gate measures against, since no MAF adapter
       * declares a `fetchSizeLimit`. 5 Mb, as `LinearBasicDisplay` uses,
       * because the index estimate is block-granular.
       * `SUB_FLOOR_BYTE_BUDGET_FACTOR` lets deep data through below the
       * force-load floor. Measurements: `MAF_LARGE_BLOCKS.md`, "Fetch dominates
       * at 470-way".
       */
      fetchSizeLimit: { type: 'number', defaultValue: 5_000_000 },
      ...trackHeightConfigSchemaFields({
        defaultHeight: DEFAULTS.height,
        height:
          'display height in pixels, the bands above the rows included; the rows divide what is left while row height fits, however many there are',
      }),
      ...rowHeightConfigSchemaFields(),
      /**
       * #slot encoding
       * The channels the aligned cells paint through: `encoding.color`, the
       * field that colors them; see [MafColor](../mafcolor).
       *
       * #example
       * ```js
       * { encoding: { color: 'identity' } }
       * ```
       */
      encoding: mafEncodingConfigSchema,
      /**
       * #slot
       * Unset, each row is one band of cells. `identity` draws each row as a
       * bar chart of its identity to the reference, the bars painted by
       * `encoding.color` where it is `identity` and in one color otherwise.
       */
      y: {
        type: 'maybeStringEnum',
        model: types.enumeration('MafYField', [...MAF_Y_FIELDS]),
        description:
          "the value a row's bar height shows: identity, or unset for none",
        plot: true,
      },
      ...treeSidebarConfigSchemaFields({
        tree: 'show the species tree sidebar',
        rowLabels: 'draw the species name over the left of each row',
      }),
      /**
       * #slot rows
       * The arrangement a reader gives the species rows, each member by row
       * name. `sort` is the row order: the guide tree rotates to it while
       * some rotation lists the species in that order; otherwise the listed
       * species lead and the rest keep adapter order. `labels`, `tree`,
       * `treeProvenance` and `kept` are what the arrangement dialog, a
       * clustering run and a focus write. The adapter's guide tree is never
       * written here.
       *
       * #example
       * ```js
       * { rows: { sort: ['mm10'], labels: { mm10: 'Mouse' } } }
       * ```
       */
      rows: sampleRowsConfigSchema,
      /**
       * #slot rowColor
       * A color per species row, drawn as the bar beside its label, over the
       * color the adapter's `samples` entry gives it.
       *
       * #example
       * ```js
       * { rowColor: { scale: { domain: ['mm10'], range: ['#f28e2b'] } } }
       * ```
       */
      rowColor: rowColorConfigSchema,
      /**
       * #slot legend
       * The color key for the active row rendering: codon-change categories,
       * source-chromosome ranks, the identity ramp and the CDS frame
       * swatches. In `bases` mode nothing draws, since there is nothing to
       * key.
       */
      legend: legendConfigSchema,
      /**
       * #slot coverage
       * The coverage band: `show`, `height`, `interbase` and
       * `minAlleleFraction`, as the alignments display spells it.
       */
      coverage: coverageBandConfigSchema,
      /**
       * #slot alignments
       * The per-species rows, which take the height the bands above them
       * leave: `show`, `rowProportion`, and the `inversions`, `frames` and
       * `reference` parts.
       */
      alignments: mafAlignmentsConfigSchema,
      /**
       * #slot
       * The coverage band's value scale, spelled as the alignments display's:
       * `symlogConstant` 1 makes symlog `log(depth+1)`.
       */
      scales: scalesSchema(
        valueScaleSchema({
          symlogConstant: 1,
        }),
      ),
      /**
       * #slot conservation
       * The band of identity to the reference: `show` (default off),
       * `height` and `unit`, `base` or `codon`.
       */
      conservation: mafConservationConfigSchema,
    },
    // #region schemaOptions
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
      retired: retiredMafSpellings,
    },
    // #endregion
  )
}

export type LinearMafDisplayConfigModel = ReturnType<typeof configSchemaF>
export type LinearMafDisplayConfig = Instance<LinearMafDisplayConfigModel>

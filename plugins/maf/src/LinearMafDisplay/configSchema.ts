import {
  COVERAGE_Y_PATHS,
  coverageBandConfigSchema,
} from '@jbrowse/alignments-core/coverageBandConfigSchema'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { legendConfigSchema } from '@jbrowse/display-kit/legendConfigSchema'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import { sampleRowsConfigSchema } from '@jbrowse/display-kit/sampleRowsConfigSchema'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { rowAxisConfigSchema } from '@jbrowse/tree-sidebar/rowAxisConfigSchema'
import { rowHeightConfigSchemaFields } from '@jbrowse/tree-sidebar/rowHeightConfigSchemaFields'

import { DEFAULTS } from './displayDefaults.ts'
import { mafAlignmentsConfigSchema } from './mafAlignmentsConfigSchema.ts'
import { mafConservationConfigSchema } from './mafConservationConfigSchema.ts'
import { mafEncodingConfigSchema } from './mafEncodingConfigSchema.ts'

import type { ConfigurationSlotPath } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
 *     axis: { labels: true },
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
       * The bytes a region may cost before the display stops and offers to
       * load it anyway, the whole budget since no MAF adapter declares a
       * `fetchSizeLimit`.
       * 5 Mb, as `LinearBasicDisplay` uses, because the index estimate is
       * block-granular.
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
       * field that colors them (see [MafColor](../mafcolor)), and
       * `encoding.y`, the field a row's bar height shows.
       *
       * #example
       * ```js
       * { encoding: { color: 'identity' } }
       * ```
       */
      encoding: mafEncodingConfigSchema,
      /**
       * #slot axis
       * The guide down the left of the species rows: the species tree and
       * each species' name. No `grid`: the rows keep a gap instead. The
       * coverage band's value axis is `coverage.encoding.y.axis`.
       */
      axis: rowAxisConfigSchema,
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
       * The coverage band: `show`, `height`, `encoding.y`, `interbase` and
       * `alleles`, as the alignments display spells it.
       */
      coverage: coverageBandConfigSchema,
      /**
       * #slot alignments
       * The per-species rows, which take the height the bands above them
       * leave: `show`, `mark.height.band`, and the `inversions`, `frames` and
       * `reference` parts.
       */
      alignments: mafAlignmentsConfigSchema,
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
    },
    // #endregion
  )
}

Object.values(
  COVERAGE_Y_PATHS.members,
) satisfies readonly ConfigurationSlotPath<ReturnType<typeof configSchemaF>>[]

export type LinearMafDisplayConfigModel = ReturnType<typeof configSchemaF>
export type LinearMafDisplayConfig = Instance<LinearMafDisplayConfigModel>

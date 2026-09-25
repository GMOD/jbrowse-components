import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { rowArrangementConfigSchema } from '@jbrowse/display-kit/rowArrangementConfigSchema'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'
import { rowHeightConfigSchemaFields } from '@jbrowse/tree-sidebar/rowHeightConfigSchemaFields'
import { treeSidebarConfigSchemaFields } from '@jbrowse/tree-sidebar/treeSidebarConfigSchemaFields'

import { CONSERVATION_MODE_VALUES } from './conservationModes.ts'
import { DEFAULTS } from './displayDefaults.ts'
import { mafColorConfigSchema } from './mafColorConfigSchema.ts'
import { refuseRetiredConfig } from './retiredSettings.ts'
import { MAF_Y_FIELDS } from './rowRenderings.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearMafDisplay
 * #category display
 * the display for a `MafTrack`: one row per aligned species, with a
 * conservation summary above them. The conservation band, per-row identity,
 * color-by-source-chromosome, and inversion overlays are all derived from the
 * alignment itself and toggled from the track menu, so the slots here are
 * show/hide defaults and band sizes.
 *
 * #example
 * Set through the track's `displayDefaults`, so the track opens in this state
 * for every viewer without each setting it from the menu. Tuning matters most
 * for a whole-genome alignment with many species: a shorter `rowHeight` fits
 * more rows on screen, and most readers scan the conservation band first.
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
 *     showConservation: true,
 *     conservationHeight: 40,
 *     showRowLabels: true,
 *   },
 * }
 * ```
 */
export default function configSchemaF() {
  // The CDS-frame annotation source is a sub-adapter on the MAF *adapter*
  // (`annotationAdapter`, alongside `summaryAdapter`), not the display. The
  // display slots below are all show/hide toggles + band sizes.
  return ConfigurationSchema(
    'LinearMafDisplay',
    {
      /**
       * #slot
       * No MAF adapter declares a `fetchSizeLimit`, so this display's value is
       * the whole budget the byte gate measures against — and MAF has no second
       * axis behind it, since `densityTooLarge` is canvas's override and false
       * here. It inherited the base 1 Mb until 2026-08-14, which nobody chose:
       * `MAF_LARGE_BLOCKS.md` § "Fetch dominates at 470-way" measures a 40 kb
       * buffered window (a 20 kb view) at 5.3 MB uncompressed for 100 rows, and
       * real MAF-BED compresses 2.9–4.0x, so an hg38 100-way — an ordinary
       * multiz, well inside the row count the same doc measures at 38–55fps —
       * came to ~1.3–1.8 MB and bannered a gene-scale view it renders fine.
       *
       * 5 Mb for the same reason `LinearBasicDisplay` uses it: the index
       * estimate is block-granular, so a tighter gate banners a view that isn't
       * large. A 470-way is ~6–8 MB over that window and so still asks **above**
       * the force-load floor — which is where asking helps, since that is the
       * zoom range `summaryAdapter` covers and the same doc's answer for that
       * row count is the summary tier rather than a raised budget. Below the
       * floor `SUB_FLOOR_BYTE_BUDGET_FACTOR` lets it through, deliberately: at a
       * locus the user navigated to, a 470-way is the same category as any other
       * deep data, and comparable in size to the ultradeep BAM the tier was
       * sized against.
       */
      fetchSizeLimit: {
        type: 'number',
        description:
          'size in bytes over which to display a warning to the user that too much data will be fetched',
        defaultValue: 5_000_000,
        advanced: true,
      },
      /**
       * #slot
       * Override the base `height` slot as a `maybeNumber`: unset means fit rows
       * to their content height, an explicit value is a drag-resized track
       * height. See the model's `fitTargetHeight` getter.
       */
      height: {
        type: 'maybeNumber',
        // stated, not omitted: the base declares `height` as a plain `number`
        // defaulting to 100, and the definition merge is a spread, so dropping
        // this key inherits that 100 and the slot is never unset — fit-to-content
        // then never runs. The one case where a `maybe*` slot needs the sentinel
        // written out.
        defaultValue: undefined,
        description:
          'display height in pixels; unset fits rows to content, bounded so a deep alignment shrinks its rows rather than growing the track off-screen',
      },
      ...rowHeightConfigSchemaFields(),
      /**
       * #slot
       */
      rowProportion: {
        type: 'number',
        defaultValue: DEFAULTS.rowProportion,
        description: 'fraction of the row height each glyph fills',
      },
      /**
       * #slot
       */
      showAllLetters: {
        type: 'boolean',
        defaultValue: DEFAULTS.showAllLetters,
        description: "draw every base's letter, not only the mismatches'",
      },
      /**
       * #slot color
       * What colours the aligned cells; see [MafColor](../mafcolor).
       *
       * #example
       * ```js
       * { color: 'identity' }
       * ```
       */
      color: mafColorConfigSchema,
      /**
       * #slot
       * Unset, each row is one band of cells. `identity` draws each row as a
       * bar chart of its identity to the reference, the bars painted by
       * `color` where it is `identity` and in one colour otherwise.
       */
      y: {
        type: 'maybeStringEnum',
        model: types.enumeration('MafYField', [...MAF_Y_FIELDS]),
        description:
          "what a row's bar height carries: identity, or unset for none",
      },
      /**
       * #slot
       */
      showAsUpperCase: {
        type: 'boolean',
        defaultValue: DEFAULTS.showAsUpperCase,
        description: 'uppercase all base letters',
      },
      // `DEFAULTS.showTree` / `showRowLabels` / `showBranchLength` were all
      // `true`, which is what the shared fields ship; the `displayDefaults`
      // block still overrides any of them per track.
      ...treeSidebarConfigSchemaFields({
        tree: 'show the species tree sidebar',
        rowLabels: 'draw the species name over the left of each row',
      }),
      /**
       * #slot rows
       * The arrangement a reader gives the species rows, each member by row
       * name. `domain` is the row order: while some rotation of the adapter's
       * guide tree lists its species in that order, the tree turns to it, the
       * way ggtree's rotate turns a clade, and keeps drawing with each listed
       * species as early as the topology allows; otherwise, or with no tree,
       * the species listed lead and the rest keep the order the adapter
       * reported them in. `labels`, `tree`, `treeProvenance` and
       * `kept` are what the arrangement dialog, a clustering run and a focus
       * write, each as a session edit to this object. The adapter's guide tree
       * is never written here.
       *
       * #example
       * ```js
       * { rows: { domain: ['mm10'], labels: { mm10: 'Mouse' } } }
       * ```
       */
      rows: rowArrangementConfigSchema,
      /**
       * #slot rowColor
       * A tint per species row, over the colour the adapter's `samples` entry
       * gives it.
       *
       * #example
       * ```js
       * { rowColor: { domain: ['mm10'], range: ['#f28e2b'] } }
       * ```
       */
      rowColor: rowColorConfigSchema,
      /**
       * #slot
       * Show the color key for the active row rendering — the codon-change
       * categories, the source-chromosome ranks, the identity ramp, and the CDS
       * frame swatches. In `bases` mode the cells are the reference's own base
       * colors and there is nothing to key, so nothing draws whatever this says.
       */
      showLegend: {
        type: 'boolean',
        description:
          'show the color key for the active row rendering. Defaults to on',
        defaultValue: true,
      },
      /**
       * #slot
       */
      showCoverage: {
        type: 'boolean',
        defaultValue: DEFAULTS.showCoverage,
        description: 'show the coverage band',
      },
      /**
       * #slot
       * Show the per-sample alignment rows. When off, only the coverage band
       * renders (independent of `showCoverage`).
       */
      showAlignments: {
        type: 'boolean',
        defaultValue: DEFAULTS.showAlignments,
        description: 'show the per-sample alignment rows',
      },
      /**
       * #slot
       */
      coverageHeight: {
        type: 'number',
        defaultValue: DEFAULTS.coverageHeight,
        description: 'height of the coverage band in px',
      },
      /**
       * #slot
       * Show the conservation band (per-bp percent identity to the reference).
       * Independent of `showCoverage`/`showAlignments`.
       */
      showConservation: {
        type: 'boolean',
        defaultValue: DEFAULTS.showConservation,
        description: 'show the conservation band',
      },
      /**
       * #slot
       */
      conservationHeight: {
        type: 'number',
        defaultValue: DEFAULTS.conservationHeight,
        description: 'height of the conservation band in px',
      },
      /**
       * #slot
       * Conservation band resolution: `base` (per-bp percent identity) or
       * `codon` (per-codon amino-acid identity; needs an `annotationAdapter`).
       */
      conservationMode: {
        type: 'stringEnum',
        model: types.enumeration(
          'MafConservationMode',
          CONSERVATION_MODE_VALUES,
        ),
        defaultValue: DEFAULTS.conservationMode,
        description: 'conservation band resolution: base or codon',
      },
      /**
       * #slot
       * When true (the default) identity, as `color` or as `y`, draws only
       * while zoomed out, and zooming in to base level swaps it back for the
       * bases, where the letters say more than a mean of them. This is UCSC
       * `wigMaf` behavior. When false identity draws at every zoom.
       *
       * The slot name is the mechanism ("auto by zoom"); what a user picks is
       * which of the two renderings they get zoomed in, which is how the menu
       * row is worded.
       */
      rowIdentityAutoZoom: {
        type: 'boolean',
        defaultValue: DEFAULTS.rowIdentityAutoZoom,
        description:
          'show the bases instead of the identity plot once zoomed in to base level (UCSC wigMaf); false draws identity at every zoom',
      },
      /**
       * #slot
       * Show the per-species CDS reading-frame overlay from the configured
       * `annotationAdapter` (UCSC `mafFrames`). No effect without one.
       */
      showAnnotations: {
        type: 'boolean',
        defaultValue: DEFAULTS.showAnnotations,
        description: 'show the per-species CDS reading-frame overlay',
      },
      /**
       * #slot
       * Draw the reference species as a row of its own.
       *
       * It is one row among the others today, and under mismatch coloring — the
       * default — every cell in it matches by definition, so it is a solid
       * match-colored bar carrying no information. UCSC omits it. The row the
       * worker named as the reference (`refSampleId`) is the one dropped, not
       * the top row and not the view's assembly name, which is a different
       * string whenever the MAF names its reference differently.
       *
       * It hides the row everywhere the row set reaches, as a subtree filter
       * does: the reference is left out of the FASTA "View subsequences"
       * downloads and out of the per-species navigation menus too. What it does
       * not touch is what the *other* rows are scored against — the mismatch
       * coloring, the coverage band and the conservation band all still read
       * the reference sequence, which the worker sends whether or not a row
       * draws it.
       */
      showReferenceRow: {
        type: 'boolean',
        defaultValue: DEFAULTS.showReferenceRow,
        description: 'give the reference species a row of its own',
      },
      /**
       * #slot
       * Overlay a strand-flip (inversion) indicator: inverted blocks get a
       * diagonal hatch.
       */
      showInversions: {
        type: 'boolean',
        defaultValue: DEFAULTS.showInversions,
        description: 'hatch strand-flipped (inverted) alignment blocks',
      },
    },
    // #region schemaOptions
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
      preProcessSnapshot: refuseRetiredConfig,
    },
    // #endregion
  )
}

export type LinearMafDisplayConfigModel = ReturnType<typeof configSchemaF>
export type LinearMafDisplayConfig = Instance<LinearMafDisplayConfigModel>

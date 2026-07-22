import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { CONSERVATION_MODE_VALUES } from './conservationModes.ts'
import { DEFAULTS } from './displayDefaults.ts'
import { ROW_IDENTITY_MODE_VALUES } from './rowIdentityModes.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

/**
 * #config LinearMafDisplay
 * #category display
 * the display for a `MafTrack`: one row per aligned species, with a
 * conservation summary above them. The conservation band, per-row identity,
 * color-by-source-chromosome, and inversion overlays are all derived from the
 * alignment itself and toggled from the track menu, so the slots here are
 * show/hide defaults and band sizes.
 */
export default function configSchemaF(pluginManager: PluginManager) {
  const LinearGenomePlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as LinearGenomeViewPlugin
  const { baseLinearDisplayConfigSchema } = LinearGenomePlugin.exports
  // The CDS-frame annotation source is a sub-adapter on the MAF *adapter*
  // (`annotationAdapter`, alongside `summaryAdapter`), not the display. The
  // display slots below are all show/hide toggles + band sizes.
  return ConfigurationSchema(
    'LinearMafDisplay',
    {
      /**
       * #slot
       * Override the base `height` slot as a `maybeNumber`: unset means fit rows
       * to their content height, an explicit value is a drag-resized track
       * height. See the model's `fitTargetHeight` getter.
       */
      height: {
        type: 'maybeNumber',
        description: 'display height in pixels; unset fits rows to content',
        defaultValue: undefined,
      },
      /**
       * #slot
       * Per-row height in px, or `0` for "fit to display height" mode where rows
       * stretch to fill the track height. The resolved value is the model's
       * `effectiveRowHeight` getter. Defaults to fit-to-height so large
       * alignments stay bounded by the track height.
       */
      rowHeight: {
        type: 'number',
        defaultValue: 0,
        description: 'per-row height in px; 0 fits rows to the display height',
      },
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
        description: 'draw every base letter instead of only mismatches',
      },
      /**
       * #slot
       */
      mismatchRendering: {
        type: 'boolean',
        defaultValue: DEFAULTS.mismatchRendering,
        description: 'color bases by mismatch to the reference',
      },
      /**
       * #slot
       */
      showAsUpperCase: {
        type: 'boolean',
        defaultValue: DEFAULTS.showAsUpperCase,
        description: 'uppercase all base letters',
      },
      /**
       * #slot
       */
      showTree: {
        type: 'boolean',
        defaultValue: DEFAULTS.showTree,
        description: 'show the species tree sidebar',
      },
      /**
       * #slot
       * Position tree nodes by their cluster merge height (dendrogram) rather
       * than evenly by topology (cladogram).
       */
      showBranchLength: {
        type: 'boolean',
        defaultValue: DEFAULTS.showBranchLength,
        description: 'position tree nodes by branch length (dendrogram)',
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
       * Per-row identity rendering shown once zoomed out past base level:
       * `heatmap` shades the row band, `xyplot` draws a per-species identity
       * wiggle, `none` keeps the base coloring at every zoom.
       */
      rowIdentityMode: {
        type: 'stringEnum',
        model: types.enumeration('RowIdentityMode', ROW_IDENTITY_MODE_VALUES),
        defaultValue: DEFAULTS.rowIdentityMode,
        description: 'per-row identity rendering: none, heatmap, or xyplot',
      },
      /**
       * #slot
       * When true the per-row identity plot follows zoom like UCSC `wigMaf`;
       * when false the selected `rowIdentityMode` is pinned on at every zoom.
       */
      rowIdentityAutoZoom: {
        type: 'boolean',
        defaultValue: DEFAULTS.rowIdentityAutoZoom,
        description: 'let zoom drive the per-row identity plot (UCSC wigMaf)',
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
       * Translate each species in the reference reading frame and draw the amino
       * acid on each codon in place of nucleotides (UCSC `wigMaf` "show
       * translation"). Needs an `annotationAdapter`.
       */
      showTranslation: {
        type: 'boolean',
        defaultValue: DEFAULTS.showTranslation,
        description: 'draw translated amino acids in place of nucleotides',
      },
      /**
       * #slot
       * Color each species' blocks by their source chromosome instead of the
       * per-base SNP coloring, surfacing translocations/rearrangements.
       */
      colorByChromosome: {
        type: 'boolean',
        defaultValue: DEFAULTS.colorByChromosome,
        description: 'color alignment blocks by source chromosome',
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
    {
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type LinearMafDisplayConfigModel = ReturnType<typeof configSchemaF>
export type LinearMafDisplayConfig = Instance<LinearMafDisplayConfigModel>

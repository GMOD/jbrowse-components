import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import { treeSidebarConfigSchemaFields } from '@jbrowse/tree-sidebar'

import { CONSERVATION_MODE_VALUES } from './conservationModes.ts'
import { DEFAULTS } from './displayDefaults.ts'
import { ROW_IDENTITY_MODE_VALUES } from './rowIdentityModes.ts'

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
 * Set through the track's `displayDefaults`, which is what makes a track open
 * in this state rather than requiring every viewer to set it from the menu. A
 * whole-genome alignment with many species is the case worth tuning: a shorter
 * `rowHeight` fits more rows on screen, and the conservation band is what most
 * readers scan first.
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
      /**
       * #slot
       * Per-row height in px, or `0` for "fit to display height" mode where rows
       * stretch to fill the track height. The resolved value is the model's
       * `effectiveRowHeight` getter. Defaults to fit-to-height so large
       * alignments stay bounded by the track height; a pinned height is honored
       * whatever the species count, with the rows that don't fit scrolled to.
       */
      rowHeight: {
        type: 'number',
        defaultValue: 0,
        description:
          'per-row height in px, scrolling the rows that do not fit; 0 fits rows to the display height instead',
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
      // `DEFAULTS.showTree` / `showRowLabels` / `showBranchLength` were all
      // `true`, which is what the shared fields ship; the `displayDefaults`
      // block still overrides any of them per track.
      ...treeSidebarConfigSchemaFields({
        tree: 'show the species tree sidebar',
        rowLabels: 'draw the species name over the left of each row',
      }),
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
        model: types.enumeration('RowIdentityMode', [
          ...ROW_IDENTITY_MODE_VALUES,
        ]),
        defaultValue: DEFAULTS.rowIdentityMode,
        description: 'per-row identity rendering: none, heatmap, or xyplot',
      },
      /**
       * #slot
       * When true (the default) the `rowIdentityMode` plot draws only while
       * zoomed out, and zooming in to base level swaps it back for the base/SNP
       * coloring — where individual bases are legible, the letters say more than
       * a per-pixel mean of them. This is UCSC `wigMaf` behavior. When false the
       * plot is pinned on at every zoom and the bases are never shown.
       *
       * The slot name is the mechanism ("auto by zoom"); what a user picks is
       * which of the two renderings they get zoomed in, which is how the menu
       * row is worded.
       */
      rowIdentityAutoZoom: {
        type: 'boolean',
        defaultValue: DEFAULTS.rowIdentityAutoZoom,
        description:
          'show the base/SNP coloring instead of the per-row identity plot once zoomed in to base level (UCSC wigMaf); false pins the plot on at every zoom',
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
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type LinearMafDisplayConfigModel = ReturnType<typeof configSchemaF>
export type LinearMafDisplayConfig = Instance<LinearMafDisplayConfigModel>

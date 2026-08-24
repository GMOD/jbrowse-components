import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config SharedLDDisplay
 * #category display
 *
 * Shared config for the two LD displays: `LDDisplay` (on a `VariantTrack`,
 * computing pairwise R² from the VCF's own genotypes) and `LDTrackDisplay` (on
 * an `LDTrack`, reading pre-computed LD such as PLINK `--r2` output). Both
 * register the same slots against different track types, so the slots live here
 * once.
 */
export default function sharedLDConfigFactory() {
  return ConfigurationSchema(
    'SharedLDDisplay',
    {
      /**
       * #slot
       * Filter variants by minor allele frequency (0-1). Variants with MAF
       * below this threshold will be hidden
       */
      minorAlleleFrequencyFilter: {
        type: 'number',
        defaultValue: 0.1,
        advanced: true,
      },
      /**
       * #slot
       * Maximum length of variants to include (in bp)
       */
      lengthCutoffFilter: {
        type: 'number',
        defaultValue: Number.MAX_SAFE_INTEGER,
        advanced: true,
      },
      /**
       * #slot
       * Height of the zone for connecting lines at the top
       */
      lineZoneHeight: {
        type: 'number',
        defaultValue: 100,
        advanced: true,
      },
      /**
       * #slot
       * LD metric to compute: 'r2' (squared correlation) or 'dprime' (normalized D)
       */
      ldMetric: {
        type: 'stringEnum',
        model: types.enumeration('LDMetric', ['r2', 'dprime']),
        defaultValue: 'r2',
      },
      /**
       * #slot
       * Whether to show the legend. Unset (the default) follows the
       * session-wide default for this display type, falling back to off; an
       * explicit true/false customizes the track.
       */
      showLegend: {
        type: 'maybeBoolean',
        // Promotable: `undefined` (unset) is the inherit state, `promotedBase`
        // (false) is what it resolves to when nothing is promoted. Read through
        // the resolved `showLegend` getter (resolveConf), never raw.
        promotedBase: false,
      },
      /**
       * #slot
       * Whether to show the LD triangle heatmap
       */
      showLDTriangle: {
        type: 'boolean',
        defaultValue: true,
      },
      /**
       * #slot
       * When true, squash the LD triangle to fit the display height
       */
      squashToHeight: {
        type: 'boolean',
        defaultValue: false,
        advanced: true,
      },
      /**
       * #slot
       * HWE filter p-value threshold (variants with HWE p < this are excluded).
       * Set to 0 to disable HWE filtering
       */
      hweFilterThreshold: {
        type: 'number',
        defaultValue: 0,
        advanced: true,
      },
      /**
       * #slot
       * Call rate filter threshold (0-1). Variants with fewer than this
       * proportion of non-missing genotypes are excluded. Set to 0 to disable.
       */
      callRateFilter: {
        type: 'number',
        defaultValue: 0,
        advanced: true,
      },
      /**
       * #slot
       * Whether to show vertical guides at the connected genome positions on hover
       */
      showVerticalGuides: {
        type: 'boolean',
        defaultValue: true,
        advanced: true,
      },
      /**
       * #slot
       * Whether to show variant labels above the tick marks
       */
      showLabels: {
        type: 'boolean',
        defaultValue: false,
        advanced: true,
      },
      /**
       * #slot
       * Height of the vertical tick marks at the genomic position
       */
      tickHeight: {
        type: 'number',
        defaultValue: 6,
        advanced: true,
      },
      /**
       * #slot
       * When true, draw cells sized according to genomic distance between SNPs
       * rather than uniform squares
       */
      useGenomicPositions: {
        type: 'boolean',
        defaultValue: false,
        advanced: true,
      },
      /**
       * #slot
       * When true, show signed LD values (-1 to 1) instead of absolute values (0 to 1).
       * For R², this shows R (correlation) instead. For D', this preserves the sign.
       */
      signedLD: {
        type: 'boolean',
        defaultValue: false,
        advanced: true,
      },
      // `jexlFilters` is BaseLinearDisplay's slot, inherited. It used to be
      // redeclared here with a description saying the expressions carry the
      // `jexl:` prefix, which is the opposite of what the base slot documents
      // (deferred evaluation stores them bare) — and nothing on this path added
      // the prefix, so an admin following either description got a worker
      // exception from the other one. The prefix now goes on at read time, in
      // `activeFilters`, for every display alike.
      /**
       * #slot
       * Starting height in pixels for the LD triangle, excluding the
       * lineZoneHeight band; drag-resizable
       */
      // An override of BaseLinearDisplay's `height` (100), which per the
      // slot-merge rule states only what differs — but `type` and
      // `defaultValue` stay, since they are what mark the entry as a slot. It
      // lives here rather than on each concrete display because both want the
      // identical 400: keeping it here is what lets those two schemas be empty,
      // which is the shape that gives each a `#config` block of its own.
      height: {
        type: 'number',
        defaultValue: 400,
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

export type LDDisplayConfigSchema = ReturnType<typeof sharedLDConfigFactory>
export type LDDisplayConfigModel = Instance<LDDisplayConfigSchema>

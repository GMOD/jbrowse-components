import { filterMenuItems } from '@jbrowse/core/ui/filterMenuItems'
import { showLegendCheckboxItem, toggleItem } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getSession } from '@jbrowse/core/util'
import { jexlFilterNarrowing } from '@jbrowse/core/util/jexlFilters'
import { squashToHeightCheckboxItem } from '@jbrowse/plugin-linear-genome-view'
import ClearAllIcon from '@mui/icons-material/ClearAll'

// lazy: this builder is reached from a state model, so a dialog named here is
// in every host's first paint — see ../shared/lazyDialogs.ts
import { JexlFilterDialog, LDFilterDialog } from '../shared/lazyDialogs.ts'
import { VARIANT_FILTER_EXAMPLES } from '../shared/variantFilterExamples.ts'

import type { LDMethod, LDMetric, LDSnp } from '../VariantRPC/getLDMatrix.ts'
import type { LDFilterModel } from '../shared/components/LDFilterDialog.tsx'
import type { Pin } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Reversibles } from '@jbrowse/core/ui/filterMenuItems'
import type { JexlFilterModel } from '@jbrowse/core/util/jexlFilters'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// Structural, so the menu's shape is testable without an MST instance (same
// arrangement as the Hi-C contact map's `buildHicTrackMenuItems`).
//
// `IStateTreeNode`, never `IAnyStateTreeNode` — the latter resolves to `any` and
// silently turns off checking for every member below. Node-ness is needed here:
// the two filter rows reach the session to queue their dialogs, and
// `AddFiltersDialog` reads the plugin manager's jexl off the node it is handed.
//
// Extends `LDFilterModel` rather than restating its three filter setters: that
// interface is the dialog's own prop type, so anything satisfying this one can
// be passed straight to it.
export interface LDMenuSelf
  extends IStateTreeNode, LDFilterModel, JexlFilterModel {
  isPrecomputedLD: boolean
  ldMethod: LDMethod | undefined
  effectiveLdMetric: LDMetric
  dprimeAvailable: boolean
  focalSnpIndex: number
  signedLD: boolean
  showLDTriangle: boolean
  showLegend: boolean
  showLegendDisplayTypeDefault: Pin
  showLabels: boolean
  showVerticalGuides: boolean
  squashToHeight: boolean
  useGenomicPositions: boolean
  setFocalSnp: (snp: LDSnp | undefined) => void
  setLDMetric: (metric: LDMetric) => void
  setSignedLD: (arg: boolean) => void
  setShowLDTriangle: (arg: boolean) => void
  setShowLegend: (arg: boolean) => void
  setShowLabels: (arg: boolean) => void
  setShowVerticalGuides: (arg: boolean) => void
  setSquashToHeight: (arg: boolean) => void
  setUseGenomicPositions: (arg: boolean) => void
}

// The metric radios' help text. Both rows state how the numbers on screen were
// actually derived, from one sentence, so the two can't describe different
// precision for the same matrix.
function metricMenuItems(self: LDMenuSelf): MenuItem[] {
  const computeNote =
    self.ldMethod === 'phased'
      ? 'Computed from phased genotypes as exact haplotypic LD.'
      : self.ldMethod === 'precomputed'
        ? 'Read directly from the pre-computed LD file.'
        : 'Estimated from unphased genotypes with the composite (Weir) method.'
  const plinkNote = self.isPrecomputedLD
    ? ''
    : ' For authoritative published LD, load PLINK-computed .ld files via the PLINK adapter.'

  return [
    {
      label: 'R² (squared correlation)',
      type: 'radio',
      checked: self.effectiveLdMetric === 'r2',
      helpText: `Squared correlation between the two variants (0-1). ${computeNote}${plinkNote}`,
      onClick: () => {
        self.setLDMetric('r2')
      },
    },
    {
      label: "D' (normalized D)",
      type: 'radio',
      checked: self.effectiveLdMetric === 'dprime',
      disabled: !self.dprimeAvailable,
      helpText: self.dprimeAvailable
        ? `Lewontin's normalized D (0-1). ${computeNote}${
            self.isPrecomputedLD
              ? ''
              : ' The composite estimate from unphased data can differ slightly from EM-based tools like Haploview.'
          }${plinkNote}`
        : "This LD file has no D' (DP) column",
      onClick: () => {
        self.setLDMetric('dprime')
      },
    },
    // Signed LD modifies the chosen metric (R instead of R², signed D'), so it
    // belongs with the metric choice rather than the visibility toggles.
    // VCF-computed LD only.
    ...(self.isPrecomputedLD
      ? []
      : [
          toggleItem(
            'Show signed LD values (-1 to 1)',
            self.signedLD,
            self.setSignedLD,
            {
              helpText:
                "When enabled, shows R (correlation) instead of R², and preserves the sign of D'. Positive values indicate alleles tend to co-occur (coupling), negative values indicate alleles tend to be on different haplotypes (repulsion).",
            },
          ),
        ]),
  ]
}

function showMenuItems(self: LDMenuSelf): MenuItem[] {
  return [
    toggleItem('Show LD triangle', self.showLDTriangle, self.setShowLDTriangle),
    showLegendCheckboxItem(
      self.showLegend,
      () => {
        self.setShowLegend(!self.showLegend)
      },
      { pin: self.showLegendDisplayTypeDefault },
    ),
    toggleItem('Show variant labels', self.showLabels, self.setShowLabels),
    toggleItem(
      'Show vertical guides on hover',
      self.showVerticalGuides,
      self.setShowVerticalGuides,
    ),
    // Layout toggles live alongside the visibility toggles in this submenu,
    // matching the Hi-C triangular display's "Show..." grouping (plugins/hic
    // trackMenuItems.ts) so the two contact-map displays stay consistent — the
    // fit-to-height row is literally the same builder they share.
    squashToHeightCheckboxItem(self),
    toggleItem(
      'Show cells with genome proportions',
      self.useGenomicPositions,
      self.setUseGenomicPositions,
      {
        helpText:
          'By default each cell is equal width (one column per variant). Enable to size cells proportional to the genomic distance between variants.',
      },
    ),
  ]
}

// The three LD-specific thresholds plus the JEXL list, declared once (see
// `Reversible`) so the count in the label and what "Clear all filters" clears
// come from the same place — they were two lists before, and a threshold added
// to one and not the other is a filter the clear silently leaves on.
//
// Counted by whether each is DOING anything rather than by whether it was
// edited: `minorAlleleFrequencyFilter` ships at 0.1 and IS dropping variants,
// which until this label existed the display said nowhere at all. 0 is the off
// value for all three. None names its own undo row — a threshold's recovery is
// the dialog's own field, and the group clear is what resets the set.
function ldNarrowings(self: LDMenuSelf): Reversibles {
  return {
    maf: {
      count: self.minorAlleleFrequencyFilter > 0 ? 1 : 0,
      clear: () => {
        self.setMafFilter(0)
      },
    },
    hwe: {
      count: self.hweFilterThreshold > 0 ? 1 : 0,
      clear: () => {
        self.setHweFilter(0)
      },
    },
    callRate: {
      count: self.callRateFilter > 0 ? 1 : 0,
      clear: () => {
        self.setCallRateFilter(0)
      },
    },
    jexlFilters: jexlFilterNarrowing(self),
  }
}

// Filters act on the genotypes LD is computed from, so a pre-computed file —
// already thinned by whatever produced it — has nothing here to filter and gets
// no menu at all.
function ldFilterMenuItems(self: LDMenuSelf): MenuItem[] {
  return self.isPrecomputedLD
    ? []
    : filterMenuItems({
        narrowings: ldNarrowings(self),
        subItems: [
          {
            label: 'LD-specific filters...',
            icon: ClearAllIcon,
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                LDFilterDialog,
                { model: self, handleClose },
              ])
            },
          },
          {
            label: 'General JEXL filters...',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                JexlFilterDialog,
                {
                  model: self,
                  handleClose,
                  examples: VARIANT_FILTER_EXAMPLES,
                },
              ])
            },
          },
        ],
      })
}

/**
 * The LD display's own track-menu rows, appended to the base display's. Lives
 * beside the model rather than inside its `.views()` chain, as the Hi-C contact
 * map's does, so the menu's shape is one readable function and can be asserted
 * without building a display.
 */
export function buildLDTrackMenuItems(self: LDMenuSelf): MenuItem[] {
  return [
    ...(self.focalSnpIndex >= 0
      ? [
          {
            label: 'Clear focal SNP highlight',
            onClick: () => {
              self.setFocalSnp(undefined)
            },
          },
        ]
      : []),
    {
      label: 'LD metric',
      subMenu: metricMenuItems(self),
    },
    ...makeShowSubMenu(showMenuItems(self)),
    ...ldFilterMenuItems(self),
  ]
}

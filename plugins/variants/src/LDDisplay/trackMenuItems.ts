import { toggleItem } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import { squashToHeightCheckboxItem } from '@jbrowse/display-kit/squashToHeightMenuItem'

import type { LDMetric, LDSnp } from '../VariantRPC/ldTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// Structural, so the menu's shape is testable without an MST instance (same
// arrangement as the Hi-C contact map's `buildHicTrackMenuItems`).
//
// `IStateTreeNode`, never `IAnyStateTreeNode` — the latter resolves to `any` and
// silently turns off checking for every member below.
export interface LDMenuSelf extends IStateTreeNode {
  effectiveLdMetric: LDMetric
  r2Available: boolean
  dprimeAvailable: boolean
  focalSnpIndex: number
  showLDTriangle: boolean
  showLegend: boolean
  showLabels: boolean
  showVerticalGuides: boolean
  squashToHeight: boolean
  useGenomicPositions: boolean
  setFocalSnp: (snp: LDSnp | undefined) => void
  setLDMetric: (metric: LDMetric) => void
  setShowLDTriangle: (arg: boolean) => void
  setShowLegend: (arg: boolean) => void
  setShowLabels: (arg: boolean) => void
  setShowVerticalGuides: (arg: boolean) => void
  setSquashToHeight: (arg: boolean) => void
  setUseGenomicPositions: (arg: boolean) => void
}

// The radios pick which of the file's columns to draw, and a file that lacks
// one says so on the disabled row rather than serving zeros under its name.
function metricMenuItems(self: LDMenuSelf): MenuItem[] {
  return [
    {
      label: 'R² (squared correlation)',
      type: 'radio',
      checked: self.effectiveLdMetric === 'r2',
      disabled: !self.r2Available,
      helpText: self.r2Available
        ? 'Squared correlation between the two variants (0-1), read from the LD file.'
        : 'This LD file has no r² (R2) column',
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
        ? "Lewontin's normalized D (0-1), read from the LD file."
        : "This LD file has no D' (DP) column",
      onClick: () => {
        self.setLDMetric('dprime')
      },
    },
  ]
}

function showMenuItems(self: LDMenuSelf): MenuItem[] {
  return [
    toggleItem('Show LD triangle', self.showLDTriangle, self.setShowLDTriangle),
    legendCheckboxItem(self),
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

/**
 * The LD display's own track-menu rows, appended to the base display's. Lives
 * beside the model rather than inside its `.views()` chain, as the Hi-C contact
 * map's does, so the menu's shape is one readable function and can be asserted
 * without building a display.
 *
 * No filter rows: the values come out of a file already thinned by whatever
 * wrote it, and there are no genotypes here to filter.
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
  ]
}

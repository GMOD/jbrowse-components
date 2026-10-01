import { toggleItem } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import { squashToHeightCheckboxItem } from '@jbrowse/display-kit/TriangleMatrixMixin'

import { variantLayoutMenuItem } from '../shared/variantLayoutMenuItem.ts'

import type { LDMetric, LDSnp } from '../VariantRPC/ldTypes.ts'
import type { VariantLayout } from '../shared/variantLayoutMenuItem.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface LDMenuSelf extends IStateTreeNode {
  effectiveLdMetric: LDMetric
  r2Available: boolean
  dprimeAvailable: boolean
  focalSnpIndex: number
  showLegend: boolean
  showLabels: boolean
  showVerticalGuides: boolean
  squashToHeight: boolean
  variantLayout: VariantLayout
  setFocalSnp: (snp: LDSnp | undefined) => void
  setLDMetric: (metric: LDMetric) => void
  setShowLegend: (arg: boolean) => void
  setShowLabels: (arg: boolean) => void
  setShowVerticalGuides: (arg: boolean) => void
  setSquashToHeight: (arg: boolean) => void
  setVariantLayout: (arg: VariantLayout) => void
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
    legendCheckboxItem(self),
    toggleItem('Show variant labels', self.showLabels, self.setShowLabels),
    toggleItem(
      'Show vertical guides on hover',
      self.showVerticalGuides,
      self.setShowVerticalGuides,
    ),
    squashToHeightCheckboxItem(self),
    variantLayoutMenuItem(self),
  ]
}

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

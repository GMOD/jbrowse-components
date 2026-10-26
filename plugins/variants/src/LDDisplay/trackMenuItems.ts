import { makeRadioSubMenu, toggleItem } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import { fitToHeightCheckboxItem } from '@jbrowse/display-kit/TriangleMatrixMixin'
import { colorSchemeMenuItem } from '@jbrowse/display-kit/colorByMenu'
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt'

import type { LDMetric, LDSnp } from '../RenderLDDataRPC/ldTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { TriangleHeightMode } from '@jbrowse/display-kit/TriangleMatrixMixin'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface LDMenuSelf extends IStateTreeNode {
  paintedColorField: LDMetric
  colorScheme: ColorSchemeName
  r2Available: boolean
  dprimeAvailable: boolean
  focalSnpIndex: number
  showLegend: boolean
  showNames: boolean
  showGuides: boolean
  heightMode: TriangleHeightMode
  variantLayout: 'genomic' | 'columns'
  setFocalSnp: (snp: LDSnp | undefined) => void
  colorByField: (metric: LDMetric) => void
  setColorScheme: (scheme: ColorSchemeName) => void
  setShowLegend: (arg: boolean) => void
  setShowNames: (arg: boolean) => void
  setShowGuides: (arg: boolean) => void
  setHeightMode: (mode: TriangleHeightMode) => void
  setVariantLayout: (arg: 'genomic' | 'columns') => void
}

// The radios write `encoding.color.field`, which of the file's columns to
// draw, and a file that lacks one says so on the disabled row rather than
// serving zeros under its name.
function metricMenuItem(self: LDMenuSelf): MenuItem {
  return makeRadioSubMenu({
    label: 'LD metric',
    value: self.paintedColorField,
    onChange: metric => {
      self.colorByField(metric)
    },
    options: [
      {
        value: 'r2',
        label: 'R² (squared correlation)',
        disabled: !self.r2Available,
        helpText: self.r2Available
          ? 'Squared correlation between the two variants (0-1), read from the LD file.'
          : 'This LD file has no r² (R2) column',
      },
      {
        value: 'dprime',
        label: "D' (normalized D)",
        disabled: !self.dprimeAvailable,
        helpText: self.dprimeAvailable
          ? "Lewontin's normalized D (0-1), read from the LD file."
          : "This LD file has no D' (DP) column",
      },
    ],
  })
}

function showMenuItems(self: LDMenuSelf): MenuItem[] {
  return [
    toggleItem('Variant labels', self.showNames, self.setShowNames),
    toggleItem('Vertical guides on hover', self.showGuides, self.setShowGuides),
    legendCheckboxItem(self),
  ]
}

function layoutMenuItem(self: LDMenuSelf): MenuItem {
  return {
    label: 'Layout',
    icon: ViewQuiltIcon,
    subMenu: [
      fitToHeightCheckboxItem(self),
      toggleItem(
        'Size cells by genomic distance',
        self.variantLayout === 'genomic',
        on => {
          self.setVariantLayout(on ? 'genomic' : 'columns')
        },
        {
          helpText:
            'Off, every SNP takes one equal-width column. On, each cell is as wide as the genomic distance between its SNPs, so the triangle lines up with the genome.',
        },
      ),
    ],
  }
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
    metricMenuItem(self),
    colorSchemeMenuItem(self),
    ...makeShowSubMenu(showMenuItems(self)),
    layoutMenuItem(self),
  ]
}

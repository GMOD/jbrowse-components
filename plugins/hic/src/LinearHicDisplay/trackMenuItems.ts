import { radioItems, toggleItem } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getBpDisplayStr } from '@jbrowse/core/util'
import { legendMenuItems } from '@jbrowse/display-kit/LegendMixin'
import { fitToHeightCheckboxItem } from '@jbrowse/display-kit/TriangleMatrixMixin'
import { colorSchemeMenuItem } from '@jbrowse/display-kit/colorByMenu'
import { makeResolutionSubMenuItem } from '@jbrowse/wiggle-core/chrome'
import BalanceIcon from '@mui/icons-material/Balance'
import GridOnIcon from '@mui/icons-material/GridOn'
import InsightsIcon from '@mui/icons-material/Insights'
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt'

import type { HicColorField, HicColorScale } from './hicColorConfigSchema.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { TriangleHeightMode } from '@jbrowse/display-kit/TriangleMatrixMixin'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

interface HicMenuSelf extends IStateTreeNode {
  colorField: HicColorField
  paintedColorField: HicColorField
  hasControl: boolean
  dataCurrent: boolean
  colorByField: (field: string) => void
  colorScaleType: HicColorScale
  colorDomainQuantile: number
  clipColorDomainQuantile: number
  showLegend: boolean
  hasLegendKey: boolean
  heightMode: TriangleHeightMode
  colorScheme: ColorSchemeName
  hasBinSizes: boolean
  canStepResolutionFiner: boolean
  canStepResolutionCoarser: boolean
  availableNormalizations: string[] | undefined
  activeNormalization: string
  appliedNormalizations: string[]
  binSize: number | undefined
  resolution: number
  setLogScale: (log: boolean) => void
  setColorDomainQuantile: (quantile: number) => void
  setShowLegend: (f: boolean) => void
  setHeightMode: (mode: TriangleHeightMode) => void
  setColorScheme: (scheme: ColorSchemeName) => void
  setNormalization: (normalization: string) => void
  stepResolution: (delta: number) => void
  setResolution: (steps: number) => void
}

function resolutionMenuItems(self: HicMenuSelf): MenuItem[] {
  return self.hasBinSizes
    ? [
        makeResolutionSubMenuItem({
          icon: GridOnIcon,
          getState: () => ({
            label:
              self.binSize === undefined ? '' : getBpDisplayStr(self.binSize),
            finerDisabled: !self.canStepResolutionFiner,
            coarserDisabled: !self.canStepResolutionCoarser,
            resetDisabled: self.resolution === 0,
          }),
          onFiner: () => {
            self.stepResolution(1)
          },
          onCoarser: () => {
            self.stepResolution(-1)
          },
          onReset: () => {
            self.setResolution(0)
          },
          resetTitle: 'Back to auto (tracks zoom)',
        }),
      ]
    : []
}

function layoutMenuItem(self: HicMenuSelf): MenuItem {
  return {
    label: 'Layout',
    icon: ViewQuiltIcon,
    subMenu: [fitToHeightCheckboxItem(self)],
  }
}

// 0.95 as the key reads it, "95th".
function percentileName(quantile: number) {
  const n = Math.round(quantile * 100)
  const tens = n % 100
  const suffix =
    tens >= 11 && tens <= 13
      ? 'th'
      : n % 10 === 1
        ? 'st'
        : n % 10 === 2
          ? 'nd'
          : n % 10 === 3
            ? 'rd'
            : 'th'
  return `${n}${suffix}`
}

function colorScaleMenuItems(self: HicMenuSelf): MenuItem[] {
  return [
    toggleItem('Log scale', self.colorScaleType !== 'linear', self.setLogScale),
    toggleItem(
      `Emphasize faint contacts (${percentileName(self.clipColorDomainQuantile)} percentile)`,
      self.colorDomainQuantile < 1,
      on => {
        self.setColorDomainQuantile(on ? self.clipColorDomainQuantile : 1)
      },
      {
        helpText: 'A domainMax set in Edit plot overrides this.',
      },
    ),
  ]
}

const FIELD_ITEMS: { value: HicColorField; label: string }[] = [
  { value: 'observed', label: 'Observed' },
  { value: 'observed/expected', label: 'Observed/expected' },
  { value: 'observed/control', label: 'Observed/control' },
]

const FALLBACK_HELP: Record<HicColorField, string> = {
  observed: '',
  'observed/expected':
    'This file has no expected values at the current resolution, so the cells show counts.',
  'observed/control':
    'The control holds none of the chromosomes in view at the current resolution, so the cells show counts.',
}

// Ticks the field the loaded cells are; a file with no expected values at the
// binsize paints counts, and the row asked for says why.
function fieldMenuItem(self: HicMenuSelf): MenuItem {
  const { colorField, paintedColorField, dataCurrent } = self
  return {
    label: 'Values',
    icon: InsightsIcon,
    subMenu: radioItems(
      FIELD_ITEMS.filter(
        item => item.value !== 'observed/control' || self.hasControl,
      ).map(item => ({
        ...item,
        helpText:
          dataCurrent &&
          item.value === colorField &&
          paintedColorField !== colorField
            ? FALLBACK_HELP[item.value]
            : undefined,
      })),
      paintedColorField,
      field => {
        self.colorByField(field)
      },
    ),
  }
}

// The schemes the file offers, ticked by what the loaded matrix carries: a
// file can hold a scheme at one binsize and not another, and for one
// chromosome and not another.
function normalizationMenuItems(self: HicMenuSelf): MenuItem[] {
  const avail = self.availableNormalizations
  const { activeNormalization, appliedNormalizations, dataCurrent } = self
  const fallbacks = appliedNormalizations.filter(n => n !== activeNormalization)
  const ticked = appliedNormalizations.includes(activeNormalization)
    ? activeNormalization
    : (fallbacks[0] ?? activeNormalization)
  return avail?.length
    ? [
        {
          label: 'Normalization',
          icon: BalanceIcon,
          subMenu: radioItems(
            avail.map(norm => ({
              value: norm,
              label: norm,
              helpText:
                !dataCurrent ||
                norm !== activeNormalization ||
                fallbacks.length === 0
                  ? undefined
                  : ticked === activeNormalization
                    ? `Some chromosome pairs in view have no ${norm} at the current resolution in this file and show ${fallbacks.join(', ')}.`
                    : `Not available at the current resolution in this file — showing ${fallbacks.join(', ')}. Zoom to a finer binsize to use it.`,
            })),
            ticked,
            norm => {
              self.setNormalization(norm)
            },
          ),
        },
      ]
    : []
}

export function buildHicTrackMenuItems(self: HicMenuSelf): MenuItem[] {
  return [
    fieldMenuItem(self),
    colorSchemeMenuItem(
      self,
      self.paintedColorField === 'observed' ? colorScaleMenuItems(self) : [],
    ),
    ...normalizationMenuItems(self),
    ...resolutionMenuItems(self),
    ...makeShowSubMenu(legendMenuItems(self)),
    layoutMenuItem(self),
  ]
}

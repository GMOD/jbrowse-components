import { makeRadioSubMenu } from '@jbrowse/wiggle-core'
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import VisibilityIcon from '@mui/icons-material/Visibility'

import ScatterPointSizeSlider from './ScatterPointSizeSlider.tsx'

import type { MenuItem } from '@jbrowse/core/ui'

const SCATTER_POINT_SIZE_DEFAULT = 2

// Shared "Show" submenu: single and multi wiggle both group their visibility
// toggles here, and both drop the whole submenu when no toggle applies (e.g.
// density mode removes cross hatches). Kept as one helper so the two displays
// can't drift on the label/icon or the empty-omit behavior.
export function makeShowSubMenu(items: MenuItem[]): MenuItem[] {
  return items.length
    ? [{ label: 'Show', icon: VisibilityIcon, subMenu: items }]
    : []
}

export function makeRenderingTypeSubMenu(
  self: { renderingType: string; setRenderingType: (t: string) => void },
  renderings: readonly (readonly [string, string])[],
): MenuItem {
  return makeRadioSubMenu({
    label: 'Plot type',
    icon: ShowChartIcon,
    value: self.renderingType,
    onChange: t => {
      self.setRenderingType(t)
    },
    options: renderings,
  })
}

// Top-level track-menu item (not nested under Plot type, for discoverability),
// present only in scatter variants ('scatter'/'multirowscatter'/'multiscatter')
// where point size applies. The submenu renders a live slider inline plus a
// reset row.
export function makePointSizeMenuItems(self: {
  renderingType: string
  scatterPointSize: number
  setScatterPointSize: (n?: number) => void
}): MenuItem[] {
  if (!self.renderingType.includes('scatter')) {
    return []
  }
  return [
    {
      label: 'Scatter point size',
      icon: ScatterPlotIcon,
      subMenu: [
        {
          label: 'Point size slider',
          type: 'custom',
          render: () => <ScatterPointSizeSlider model={self} />,
        },
        {
          label: 'Reset to default size',
          disabled: self.scatterPointSize === SCATTER_POINT_SIZE_DEFAULT,
          onClick: () => {
            self.setScatterPointSize(undefined)
          },
        },
      ],
    },
  ]
}

interface WithResolution {
  hasResolution: boolean
  resolution: number
  summaryScoreMode: string
  isDensityMode: boolean
  setResolution: (n: number) => void
  setSummaryScoreMode: (v: string) => void
}

export function makeResolutionAndSummarySubMenus(
  self: WithResolution,
): MenuItem[] {
  if (!self.hasResolution) {
    return []
  }
  return [
    {
      label: 'Resolution',
      subMenu: [
        {
          label: 'Finer resolution',
          onClick: () => {
            self.setResolution(self.resolution * 5)
          },
        },
        {
          label: 'Coarser resolution',
          onClick: () => {
            self.setResolution(self.resolution / 5)
          },
        },
        {
          label: 'Reset to default resolution',
          disabled: self.resolution === 1,
          onClick: () => {
            self.setResolution(1)
          },
        },
      ],
    },
    {
      label: 'Summary score mode',
      subMenu: (
        [
          ['min', 'Minimum'],
          ['max', 'Maximum'],
          ['avg', 'Average'],
          ['whiskers', 'Whiskers'],
        ] as const
      ).map(([value, label]) => ({
        label,
        type: 'radio' as const,
        checked: self.summaryScoreMode === value,
        // whiskers is ignored in density mode (score maps to color, not height)
        disabled: value === 'whiskers' && self.isDensityMode,
        disabledHelpText: 'Not available in density mode',
        onClick: () => {
          self.setSummaryScoreMode(value)
        },
      })),
    },
  ]
}

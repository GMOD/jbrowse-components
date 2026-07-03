import { makeRadioSubMenu } from '@jbrowse/wiggle-core'
import ShowChartIcon from '@mui/icons-material/ShowChart'

import type { MenuItem } from '@jbrowse/core/ui'

const SCATTER_POINT_SIZE_DEFAULT = 2

export function makeRenderingTypeSubMenu(
  self: {
    renderingType: string
    setRenderingType: (t: string) => void
    scatterPointSize: number
    setScatterPointSize: (n?: number) => void
  },
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
    // point size only affects scatter variants ('scatter'/'multirowscatter'/
    // 'multiscatter'), so it's grouped with the plot type it modifies and
    // hidden otherwise
    extraItems: self.renderingType.includes('scatter')
      ? [makePointSizeSubMenu(self)]
      : [],
  })
}

function makePointSizeSubMenu(self: {
  scatterPointSize: number
  setScatterPointSize: (n?: number) => void
}): MenuItem {
  const isDefault = self.scatterPointSize === SCATTER_POINT_SIZE_DEFAULT
  return {
    label: 'Point size',
    subMenu: [
      {
        label: 'Larger points',
        onClick: () => {
          self.setScatterPointSize(self.scatterPointSize + 1)
        },
      },
      {
        label: 'Smaller points',
        disabled: self.scatterPointSize <= 1,
        onClick: () => {
          self.setScatterPointSize(Math.max(1, self.scatterPointSize - 1))
        },
      },
      {
        label: 'Reset to default size',
        disabled: isDefault,
        onClick: () => {
          self.setScatterPointSize(undefined)
        },
      },
    ],
  }
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

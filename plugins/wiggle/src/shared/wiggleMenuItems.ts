import { makeRadioSubMenu } from '@jbrowse/wiggle-core'
import BarChartIcon from '@mui/icons-material/BarChart'

import type { MenuItem } from '@jbrowse/core/ui'

export function makeRenderingTypeSubMenu(
  self: { renderingType: string; setRenderingType: (t: string) => void },
  renderings: readonly (readonly [string, string])[],
): MenuItem {
  return makeRadioSubMenu({
    label: 'Plot type',
    icon: BarChartIcon,
    value: self.renderingType,
    onChange: t => {
      self.setRenderingType(t)
    },
    options: renderings,
  })
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
          label:
            self.resolution === 1
              ? 'Default resolution (current)'
              : 'Reset to default resolution',
          disabled: self.resolution === 1,
          onClick: () => {
            self.setResolution(1)
          },
        },
      ],
    },
    {
      label: 'Summary score mode',
      subMenu: (['min', 'max', 'avg', 'whiskers'] as const).map(elt => ({
        label: elt,
        type: 'radio' as const,
        checked: self.summaryScoreMode === elt,
        // whiskers is ignored in density mode (score maps to color, not height)
        disabled: elt === 'whiskers' && self.isDensityMode,
        disabledHelpText: 'Not available in density mode',
        onClick: () => {
          self.setSummaryScoreMode(elt)
        },
      })),
    },
  ]
}

import type { MenuItem } from '@jbrowse/core/ui'

interface WithResolution {
  hasResolution: boolean
  resolution: number
  summaryScoreMode: string
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
      ],
    },
    {
      label: 'Summary score mode',
      subMenu: (['min', 'max', 'avg', 'whiskers'] as const).map(elt => ({
        label: elt,
        type: 'radio' as const,
        checked: self.summaryScoreMode === elt,
        onClick: () => {
          self.setSummaryScoreMode(elt)
        },
      })),
    },
  ]
}

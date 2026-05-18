import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import EqualizerIcon from '@mui/icons-material/Equalizer'

import { makeAutoscaleTypeSubMenu } from './wiggleMenuItems.ts'

const SetMinMaxDialog = lazy(() => import('./SetMinMaxDialog.tsx'))

interface MenuSelf {
  scaleType: string
  autoscaleType: string
  minScore: number
  maxScore: number
  displayCrossHatches: boolean
  setScaleType: (v: string) => void
  setAutoscale: (v?: string) => void
  setMinScore: (n?: number) => void
  setMaxScore: (n?: number) => void
  toggleCrossHatches: () => void
}

// Cross-display menu items: Score submenu (autoscale + min/max) and the
// cross hatches toggle. Both LinearWiggleDisplay (bars) and
// LinearManhattanDisplay (GWAS points) compose these into their own
// trackMenuItems. Wiggle's bar-only items (rendering type, summary score
// mode, scale type) stay in LinearWiggleDisplay/model.ts and are injected
// here via `extraScoreItems` if needed.
export function rendererMenuItems(
  self: MenuSelf,
  opts: { extraScoreItems?: unknown[] } = {},
) {
  return [
    {
      label: 'Score',
      icon: EqualizerIcon,
      subMenu: [
        ...(opts.extraScoreItems ?? []),
        makeAutoscaleTypeSubMenu(self),
        {
          label: 'Set min/max score',
          onClick: () => {
            getSession(self).queueDialog(handleClose => [
              SetMinMaxDialog,
              { model: self, handleClose },
            ])
          },
        },
      ],
    },
    {
      label: 'Draw cross hatches',
      type: 'checkbox' as const,
      checked: self.displayCrossHatches,
      onClick: () => {
        self.toggleCrossHatches()
      },
    },
  ]
}

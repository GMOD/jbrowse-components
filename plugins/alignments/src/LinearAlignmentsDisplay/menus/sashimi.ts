import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import AltRouteIcon from '@mui/icons-material/AltRoute'

import { checkboxItem, radioModeMenuItem } from './menuHelpers.ts'

import type { SashimiArcsMode } from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const SetSashimiScoreDialog = lazy(
  () => import('../dialogs/SetSashimiScoreDialog.tsx'),
)

const SASHIMI_MODE_OPTIONS: { value: SashimiArcsMode; label: string }[] = [
  { value: 'auto', label: 'Auto (minimize overlap)' },
  { value: 'up', label: 'Above coverage' },
  { value: 'down', label: 'Below coverage' },
]

interface SashimiModel {
  showSashimiArcs: boolean
  setShowSashimiArcs: (show: boolean) => void
  showSashimiLabels: boolean
  setShowSashimiLabels: (show: boolean) => void
  sashimiArcsMode: SashimiArcsMode
  setSashimiArcsMode: (mode: SashimiArcsMode) => void
  minSashimiScore: number
  setMinSashimiScore: (score: number) => void
}

// All sashimi (splice-junction arc) controls in one place. The labels,
// placement, and score-filter options tune what's already drawn, so they're
// revealed only when the arcs are on (never shown disabled).
export function getSashimiMenuItem(model: SashimiModel) {
  return {
    label: 'Sashimi arcs',
    icon: AltRouteIcon,
    type: 'subMenu' as const,
    subMenu: [
      checkboxItem('Show sashimi arcs', model.showSashimiArcs, () => {
        model.setShowSashimiArcs(!model.showSashimiArcs)
      }),
      ...(model.showSashimiArcs
        ? [
            checkboxItem('Show labels', model.showSashimiLabels, () => {
              model.setShowSashimiLabels(!model.showSashimiLabels)
            }),
            radioModeMenuItem(
              'Arc placement',
              SASHIMI_MODE_OPTIONS,
              model.sashimiArcsMode,
              mode => {
                model.setSashimiArcsMode(mode)
              },
            ),
            {
              label: 'Filter by score...',
              onClick: () => {
                getSession(model).queueDialog(handleClose => [
                  SetSashimiScoreDialog,
                  { model, handleClose },
                ])
              },
            },
          ]
        : []),
    ] satisfies MenuItem[],
  }
}

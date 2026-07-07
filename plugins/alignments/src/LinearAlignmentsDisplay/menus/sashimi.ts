import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import AltRouteIcon from '@mui/icons-material/AltRoute'

import { checkboxItem } from './menuHelpers.ts'
import {
  promotableRadioItem,
  promotableToggleItem,
} from './promotableToggleItem.tsx'

import type { SessionDefaultControl } from './sessionDefaultControl.ts'
import type { SashimiArcsMode } from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const SetSashimiScoreDialog = lazy(
  () => import('../dialogs/SetSashimiScoreDialog.tsx'),
)

// 'up' is the base/un-pinned value (mirrors readConnections's 'off'), so it
// carries no session-default control — only 'down' and 'auto' are pinnable.
const SASHIMI_MODE_OPTIONS: {
  value: SashimiArcsMode
  label: string
  sessionDefaultKey?: 'sashimiDownSessionDefault' | 'sashimiAutoSessionDefault'
}[] = [
  {
    value: 'auto',
    label: 'Auto (minimize overlap)',
    sessionDefaultKey: 'sashimiAutoSessionDefault',
  },
  { value: 'up', label: 'Above coverage' },
  {
    value: 'down',
    label: 'Below coverage',
    sessionDefaultKey: 'sashimiDownSessionDefault',
  },
]

interface SashimiModel {
  showSashimiArcs: boolean
  setShowSashimiArcs: (show: boolean) => void
  showSashimiLabels: boolean
  setShowSashimiLabels: (show: boolean) => void
  showSashimiLabelsSessionDefault: SessionDefaultControl
  sashimiArcsMode: SashimiArcsMode
  setSashimiArcsMode: (mode: SashimiArcsMode) => void
  sashimiDownSessionDefault: SessionDefaultControl
  sashimiAutoSessionDefault: SessionDefaultControl
  minSashimiScore: number
  setMinSashimiScore: (score: number) => void
}

// All sashimi (splice-junction arc) controls in one place. The labels,
// placement, and score-filter options tune what's already drawn, so they're
// revealed only when the arcs are on (never shown disabled).
export function getSashimiMenuItem(model: SashimiModel) {
  const subMenu: MenuItem[] = [
    checkboxItem('Show sashimi arcs', model.showSashimiArcs, () => {
      model.setShowSashimiArcs(!model.showSashimiArcs)
    }),
    ...(model.showSashimiArcs
      ? [
          promotableToggleItem({
            label: 'Show labels',
            checked: model.showSashimiLabels,
            onToggle: () => {
              model.setShowSashimiLabels(!model.showSashimiLabels)
            },
            sessionDefault: model.showSashimiLabelsSessionDefault,
          }),
          {
            label: 'Arc placement',
            type: 'subMenu' as const,
            subMenu: SASHIMI_MODE_OPTIONS.map(option =>
              promotableRadioItem({
                label: option.label,
                checked: model.sashimiArcsMode === option.value,
                onClick: () => {
                  model.setSashimiArcsMode(option.value)
                },
                sessionDefault: option.sessionDefaultKey
                  ? model[option.sessionDefaultKey]
                  : undefined,
              }),
            ),
          },
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
  ]
  return {
    label: 'Sashimi arcs',
    icon: AltRouteIcon,
    type: 'subMenu' as const,
    subMenu,
  }
}

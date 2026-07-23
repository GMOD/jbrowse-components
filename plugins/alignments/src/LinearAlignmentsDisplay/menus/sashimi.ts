import {
  makeSizeMenu,
  promotableRadioItem,
  promotableToggleItem,
} from '@jbrowse/core/ui'
import AltRouteIcon from '@mui/icons-material/AltRoute'

import { DEFAULT_MIN_SASHIMI_SCORE } from '../constants.ts'
import { checkboxItem } from './menuHelpers.ts'

import type { SashimiArcsMode } from '../constants.ts'
import type { DisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

// 'up' is the base (inherit) value (mirrors readConnections's 'off'), so it
// carries no session-default control — only 'down' and 'auto' are promotable.
const SASHIMI_MODE_OPTIONS: {
  value: SashimiArcsMode
  label: string
  displayTypeDefaultKey?:
    | 'sashimiDownDisplayTypeDefault'
    | 'sashimiAutoDisplayTypeDefault'
}[] = [
  {
    value: 'auto',
    label: 'Auto (minimize overlap)',
    displayTypeDefaultKey: 'sashimiAutoDisplayTypeDefault',
  },
  { value: 'up', label: 'Above coverage' },
  {
    value: 'down',
    label: 'Below coverage',
    displayTypeDefaultKey: 'sashimiDownDisplayTypeDefault',
  },
]

interface SashimiModel {
  showSashimiArcs: boolean
  setShowSashimiArcs: (show: boolean) => void
  showSashimiLabels: boolean
  setShowSashimiLabels: (show: boolean) => void
  showSashimiLabelsDisplayTypeDefault: DisplayTypeDefaultControl
  sashimiArcsMode: SashimiArcsMode
  setSashimiArcsMode: (mode: SashimiArcsMode) => void
  sashimiDownDisplayTypeDefault: DisplayTypeDefaultControl
  sashimiAutoDisplayTypeDefault: DisplayTypeDefaultControl
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
            displayTypeDefault: model.showSashimiLabelsDisplayTypeDefault,
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
                displayTypeDefault: option.displayTypeDefaultKey
                  ? model[option.displayTypeDefaultKey]
                  : undefined,
              }),
            ),
          },
          makeSizeMenu({
            label: 'Filter by score',
            title: 'Min read support',
            // read support spans small integers to thousands on deep RNA-seq,
            // so log-scale; 0 shows every arc, including the single-read
            // junctions the default filters out. Recomputes arcs on the main
            // thread (tier 3), so a live onChange is fine.
            scale: 'log',
            min: 0,
            max: 10_000,
            format: n => `${n}`,
            getValue: () => model.minSashimiScore,
            isDefault: model.minSashimiScore === DEFAULT_MIN_SASHIMI_SCORE,
            onChange: score => {
              model.setMinSashimiScore(score)
            },
            onReset: () => {
              model.setMinSashimiScore(DEFAULT_MIN_SASHIMI_SCORE)
            },
          }),
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

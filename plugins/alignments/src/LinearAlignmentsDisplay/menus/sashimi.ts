import { makeSizeMenu } from '@jbrowse/core/ui'
import {
  promotableRadioItem,
  promotableToggleItem,
} from '@jbrowse/core/ui/menuItems'
import AltRouteIcon from '@mui/icons-material/AltRoute'

import { DEFAULT_MIN_SASHIMI_SCORE } from '../constants.ts'

import type { SashimiArcsMode } from '../constants.ts'
import type { DisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

// Every option carries a pin, the base value 'up' included — once a non-base
// mode is promoted, pinning the base back is the only per-value way to undo it
// from its own row, and a radio group where one row is silently missing its
// trailing control reads as a bug. Matches the heightMode group.
const SASHIMI_MODE_OPTIONS: { value: SashimiArcsMode; label: string }[] = [
  { value: 'auto', label: 'Auto (minimize overlap)' },
  { value: 'up', label: 'Above coverage' },
  { value: 'down', label: 'Below coverage' },
]

interface SashimiModel {
  showSashimiArcs: boolean
  setShowSashimiArcs: (show: boolean) => void
  showSashimiArcsDisplayTypeDefault: DisplayTypeDefaultControl
  showSashimiLabels: boolean
  setShowSashimiLabels: (show: boolean) => void
  showSashimiLabelsDisplayTypeDefault: DisplayTypeDefaultControl
  sashimiArcsMode: SashimiArcsMode
  setSashimiArcsMode: (mode: SashimiArcsMode) => void
  sashimiArcsModeDisplayTypeDefault: (
    mode: SashimiArcsMode,
  ) => DisplayTypeDefaultControl
  minSashimiScore: number
  setMinSashimiScore: (score: number) => void
}

// All sashimi (splice-junction arc) controls in one place. The labels,
// placement, and score-filter options tune what's already drawn, so they're
// revealed only when the arcs are on (never shown disabled).
export function getSashimiMenuItem(model: SashimiModel) {
  const subMenu: MenuItem[] = [
    promotableToggleItem({
      label: 'Show sashimi arcs',
      checked: model.showSashimiArcs,
      onToggle: () => {
        model.setShowSashimiArcs(!model.showSashimiArcs)
      },
      displayTypeDefault: model.showSashimiArcsDisplayTypeDefault,
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
                displayTypeDefault: model.sashimiArcsModeDisplayTypeDefault(
                  option.value,
                ),
              }),
            ),
          },
          makeSizeMenu({
            label: 'Filter by score',
            title: 'Min read support',
            // read support spans small integers to thousands on deep RNA-seq, so
            // log-scale. 1 already shows every arc (filter is `count >= min` and
            // a junction has at least one read); 0 would be a dead notch, since
            // sliderScale('log') clamps to `Math.max(1, n)`. Recomputes arcs on
            // the main thread (tier 3), so a live onChange is fine.
            scale: 'log',
            min: 1,
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

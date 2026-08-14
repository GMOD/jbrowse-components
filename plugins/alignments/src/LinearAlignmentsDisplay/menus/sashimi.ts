import { makeSizeMenu } from '@jbrowse/core/ui'
import {
  promotableRadioItems,
  promotableToggleItem,
} from '@jbrowse/core/ui/menuItems'
import AltRouteIcon from '@mui/icons-material/AltRoute'

import { DEFAULT_MIN_SASHIMI_SCORE } from '../constants.ts'

import type { SashimiArcsMode } from '../constants.ts'
import type { Pin } from '@jbrowse/core/configuration'
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
  showSashimiArcsDisplayTypeDefault: Pin
  showSplitJunctionArcs: boolean
  setShowSplitJunctionArcs: (show: boolean) => void
  showSplitJunctionArcsDisplayTypeDefault: Pin
  showSashimiLabels: boolean
  setShowSashimiLabels: (show: boolean) => void
  showSashimiLabelsDisplayTypeDefault: Pin
  sashimiArcsMode: SashimiArcsMode
  setSashimiArcsMode: (mode: SashimiArcsMode) => void
  sashimiArcsModeDisplayTypeDefault: (mode: SashimiArcsMode) => Pin
  minSashimiScore: number
  setMinSashimiScore: (score: number) => void
}

// All junction-arc controls in one place. The labels, placement, and score-
// filter options tune what's already drawn, so they're revealed only when some
// arcs are on (never shown disabled).
//
// TWO sources feed this band and they get one row each, then share everything
// below: splice junctions from the coverage pipeline's skip gaps, and split-read
// junctions coalesced from the reads' own SA segments. The shared settings are
// shared on purpose rather than duplicated per source — "how many reads before
// an arc is worth ink" and "draw the count on it" are the same question for
// both, and a second copy of each would double this menu to say the same things.
// Placement is the one that genuinely differs: split-junction arcs always draw
// above coverage (see `computeSplitJunctionArcs`), so the radio group below
// governs the splice arcs alone and only appears with them.
export function getSashimiMenuItem(model: SashimiModel) {
  const anyArcs = model.showSashimiArcs || model.showSplitJunctionArcs
  const subMenu: MenuItem[] = [
    promotableToggleItem({
      label: 'Show sashimi arcs',
      checked: model.showSashimiArcs,
      onToggle: () => {
        model.setShowSashimiArcs(!model.showSashimiArcs)
      },
      pin: model.showSashimiArcsDisplayTypeDefault,
    }),
    promotableToggleItem({
      label: 'Show split-read junction arcs',
      checked: model.showSplitJunctionArcs,
      onToggle: () => {
        model.setShowSplitJunctionArcs(!model.showSplitJunctionArcs)
      },
      pin: model.showSplitJunctionArcsDisplayTypeDefault,
      helpText:
        'coalesce the split reads crossing one breakpoint into a single arc over the coverage band, with its stroke width and count label from the number of supporting molecules. Unlike a sashimi arc this can join two chromosomes, so a fusion or translocation shown as two regions of one view draws one arc across the seam. The per-read curves stay in the pileup below; this is their total.',
    }),
    ...(anyArcs
      ? [
          promotableToggleItem({
            label: 'Show labels',
            checked: model.showSashimiLabels,
            onToggle: () => {
              model.setShowSashimiLabels(!model.showSashimiLabels)
            },
            pin: model.showSashimiLabelsDisplayTypeDefault,
          }),
          ...(model.showSashimiArcs
            ? [
                {
                  label: 'Arc placement',
                  type: 'subMenu' as const,
                  subMenu: promotableRadioItems(
                    SASHIMI_MODE_OPTIONS,
                    model.sashimiArcsMode,
                    mode => {
                      model.setSashimiArcsMode(mode)
                    },
                    mode => model.sashimiArcsModeDisplayTypeDefault(mode),
                  ),
                },
              ]
            : []),
          makeSizeMenu({
            label: 'Filter by score',
            title: 'Min read support',
            // read support spans small integers to thousands on deep RNA-seq, so
            // log-scale. 1 already shows every arc (filter is `count >= min` and
            // a junction has at least one read); 0 would be a dead notch, since
            // sliderScale('log') clamps to `Math.max(1, n)`. Recomputes arcs on
            // the main thread (tier 3), so a live onChange is fine.
            //
            // Governs BOTH sources — see this function's header for why they
            // share it rather than getting a threshold each.
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

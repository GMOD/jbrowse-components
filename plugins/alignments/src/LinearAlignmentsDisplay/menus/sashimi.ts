import { makeSizeSubMenu } from '@jbrowse/core/ui'
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
  showSashimiLabels: boolean
  setShowSashimiLabels: (show: boolean) => void
  showSashimiLabelsDisplayTypeDefault: Pin
  sashimiArcsMode: SashimiArcsMode
  setSashimiArcsMode: (mode: SashimiArcsMode) => void
  sashimiArcsModeDisplayTypeDefault: (mode: SashimiArcsMode) => Pin
  minSashimiScore: number
  setMinSashimiScore: (score: number) => void
  hideNonCanonicalJunctions: boolean
  setHideNonCanonicalJunctions: (hide: boolean) => void
  hideNonCanonicalJunctionsDisplayTypeDefault: Pin
}

// All sashimi (splice-junction arc) controls in one place. The labels,
// placement, and filter options tune what's already drawn, so they're revealed
// only when the arcs are on (never shown disabled).
//
// ARITY ORDERS THE REVEALED ROWS — the checkboxes, then the choice, then the
// value — so the row shape changes once down the menu rather than flickering,
// the rule the synteny and dotplot settings menus already follow. It puts the
// two filters (the non-canonical toggle and the read-support floor) at opposite
// ends of the menu on purpose: five rows do not earn the section headings that
// would let subject group them, and a lone submenu between two checkboxes reads
// as a mis-set row.
//
// The floor is a submenu holding its slider (`makeSizeSubMenu`) for the same
// reason. Drawn inline it is a two-line block carrying a widget no other row
// here has, which is fine where a menu has one of them and wrong beside four
// rows of `label + (checkbox | chevron)`.
//
// NO ROW CARRIES A `?`. Each label already says what its setting does, and the
// splice motifs behind "non-canonical" are on the page a reader reaches for
// them on — the user guide's sashimi section, the arc's own tooltip and its
// detail panel, all of which can name the motif THIS junction has. A tooltip
// repeating that in the abstract is a fourth copy that goes stale first.
export function getSashimiMenuItem(model: SashimiModel) {
  const subMenu: MenuItem[] = [
    promotableToggleItem({
      label: 'Show sashimi arcs',
      checked: model.showSashimiArcs,
      onToggle: () => {
        model.setShowSashimiArcs(!model.showSashimiArcs)
      },
      pin: model.showSashimiArcsDisplayTypeDefault,
    }),
    ...(model.showSashimiArcs
      ? [
          promotableToggleItem({
            label: 'Show labels',
            checked: model.showSashimiLabels,
            onToggle: () => {
              model.setShowSashimiLabels(!model.showSashimiLabels)
            },
            pin: model.showSashimiLabelsDisplayTypeDefault,
          }),
          promotableToggleItem({
            label: 'Hide non-canonical junctions',
            checked: model.hideNonCanonicalJunctions,
            onToggle: () => {
              model.setHideNonCanonicalJunctions(
                !model.hideNonCanonicalJunctions,
              )
            },
            pin: model.hideNonCanonicalJunctionsDisplayTypeDefault,
          }),
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
          makeSizeSubMenu({
            label: 'min read support',
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

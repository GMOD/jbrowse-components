import { makeSizeSubMenu } from '@jbrowse/core/ui'
import { radioItems, toggleItem } from '@jbrowse/core/ui/menuItems'
import { categoryFilterItem } from '@jbrowse/display-kit/categoryFilter'
import AltRouteIcon from '@mui/icons-material/AltRoute'

import { DEFAULT_MIN_SASHIMI_READS } from '../../shared/alignmentsFilter.ts'

import type { JunctionFilter } from '../../shared/types.ts'
import type { SashimiPlacement } from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const SASHIMI_PLACEMENT_OPTIONS: { value: SashimiPlacement; label: string }[] =
  [
    { value: 'auto', label: 'Auto (minimize overlap)' },
    { value: 'up', label: 'Above coverage' },
    { value: 'down', label: 'Below coverage' },
  ]

interface SashimiModel {
  showCoverage: boolean
  showSashimi: boolean
  setShowSashimi: (show: boolean) => void
  showSashimiCounts: boolean
  setShowSashimiCounts: (show: boolean) => void
  sashimiPlacement: SashimiPlacement
  setSashimiPlacement: (placement: SashimiPlacement) => void
  junctionFilter: JunctionFilter
  setJunctionFilter: (patch: Partial<JunctionFilter>) => void
}

// All sashimi (splice-junction arc) controls in one place. The counts,
// placement and filter options tune what's already drawn, so they're revealed
// only when the arcs are on (never shown disabled).
//
// ARITY ORDERS THE REVEALED ROWS — the checkboxes, then the choices, then the
// value — so the row shape changes once down the menu rather than flickering,
// the rule the synteny and dotplot settings menus already follow.
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
//
// Without the coverage band the arcs draw in their own strip, so placement
// has nothing to choose and is greyed out, naming the switch.
export function getSashimiMenuItem(model: SashimiModel) {
  const subMenu: MenuItem[] = [
    toggleItem('Show sashimi arcs', model.showSashimi, show => {
      model.setShowSashimi(show)
    }),
    ...(model.showSashimi
      ? [
          toggleItem('Show read counts', model.showSashimiCounts, show => {
            model.setShowSashimiCounts(show)
          }),
          {
            label: 'Arc placement',
            type: 'subMenu' as const,
            subMenu: radioItems(
              SASHIMI_PLACEMENT_OPTIONS,
              model.sashimiPlacement,
              placement => {
                model.setSashimiPlacement(placement)
              },
            ),
            ...(model.showCoverage
              ? {}
              : {
                  disabled: true,
                  disabledHelpText:
                    'Without the coverage band the arcs draw in a strip of their own — turn on Show... → Coverage to place them over it',
                }),
          },
          categoryFilterItem(
            {
              noun: 'Non-canonical junctions',
              all: 'All junctions',
              only: 'Only non-canonical junctions',
              exclude: 'Hide non-canonical junctions',
            },
            model.junctionFilter.nonCanonical,
            nonCanonical => {
              model.setJunctionFilter({ nonCanonical })
            },
          ),
          makeSizeSubMenu({
            label: 'Min read support',
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
            getValue: () => model.junctionFilter.minReads,
            isDefault:
              model.junctionFilter.minReads === DEFAULT_MIN_SASHIMI_READS,
            onChange: minReads => {
              model.setJunctionFilter({ minReads })
            },
            onReset: () => {
              model.setJunctionFilter({ minReads: DEFAULT_MIN_SASHIMI_READS })
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

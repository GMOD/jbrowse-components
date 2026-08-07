import FilterAltIcon from '@mui/icons-material/FilterAlt'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'

import type { MenuItem } from './MenuTypes.ts'

export interface FilterMenuOpts {
  /**
   * How many independent filters are narrowing the view right now, so the label
   * can say that something is hiding data. Count a filter when its value is not
   * its **no-op** value, which is not always its config default: the LD
   * display's `minorAlleleFrequencyFilter` ships at 0.1 and is genuinely
   * dropping variants, while the alignments flag masks default non-zero and are
   * the no-filtering state, so they count only when edited away from it.
   *
   * This is usually the only affordance telling the user a filter is silently
   * hiding rows — nothing else in the track chrome says so.
   */
  activeCount: number
  /** Opens the display's filter dialog, where it has a single one. */
  onEdit?: () => void
  /** Controls that belong inside the submenu (inline sliders, further dialogs). */
  subItems?: MenuItem[]
  /**
   * Recovery rows offered alongside "Clear all filters" once something is
   * filtering — the canvas display's "Show N hidden features", for one.
   */
  recoveryItems?: MenuItem[]
  /** Turn every filter off. Offered only while `activeCount` is non-zero. */
  onClear?: () => void
  /** Rides the top-level row; see the canvas display's RECOVERY_PRIORITY. */
  priority?: number
  /** Label for the dialog opener inside the submenu. */
  editLabel?: string
}

/**
 * The "Filter by..." family, in the one shape every display uses.
 *
 * On a track with nothing to recover this is the single dialog opener, because
 * a submenu wrapping one row is pure indirection. Once filters are on — or a
 * display contributes its own inline controls — the recovery rows join it and
 * the group earns its submenu, with the dialog opener as its first row.
 *
 * Spread, don't insert: a display with neither a dialog nor sub-items (a
 * pre-computed LD file has nothing to filter) contributes no row at all.
 *
 * Written once because the four copies had drifted into four designs, and only
 * the alignments one put the active count in the label — so a filtered LD or
 * multi-sample variant track said nothing, anywhere, about the rows it was
 * dropping.
 */
export function filterMenuItems({
  activeCount,
  onEdit,
  subItems = [],
  recoveryItems = [],
  onClear,
  priority,
  editLabel = 'Edit filters...',
}: FilterMenuOpts): MenuItem[] {
  const label =
    activeCount > 0 ? `Filter by... (${activeCount})` : 'Filter by...'
  const editItem: MenuItem[] = onEdit
    ? [
        {
          label: editLabel,
          icon: FilterAltIcon,
          onClick: onEdit,
        },
      ]
    : []
  const clearItem: MenuItem[] =
    onClear && activeCount > 0
      ? [
          {
            label: 'Clear all filters',
            icon: FilterAltOffIcon,
            onClick: onClear,
          },
        ]
      : []
  const rows = [...editItem, ...subItems, ...recoveryItems, ...clearItem]
  if (!rows.length) {
    return []
  }
  // the lone dialog opener stays a top-level row rather than a one-item submenu
  return rows.length === 1 && onEdit
    ? [{ label, icon: FilterAltIcon, priority, onClick: onEdit }]
    : [{ label, icon: FilterAltIcon, priority, type: 'subMenu', subMenu: rows }]
}

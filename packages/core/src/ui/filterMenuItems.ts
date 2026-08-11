import FilterAltIcon from '@mui/icons-material/FilterAlt'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'

import type { MenuItem } from './MenuTypes.ts'

/**
 * One reversible piece of display state — a filter, a hidden set, a collected
 * "show only these", a highlight set — declared once so that the three things a
 * display currently derives separately all come from the same place: how many
 * of them are in effect, the row offered to undo this one, and the group-level
 * "clear everything".
 *
 * It exists because those three drifted apart, repeatedly and silently, and the
 * failures are invisible rather than loud:
 *
 * - a set with no undo row at all (canvas `pinnedFeatureIds`: persistent,
 *   layout-affecting, and reachable only from the pinned feature's own
 *   right-click menu, so a pin left on another chromosome could not be reached);
 * - an undo derived from the state's ABSENCE, so it vanished with the thing it
 *   undid (the canvas colour key's "×" was a one-way door for the session);
 * - a count derived from a different predicate than the state's actual effect
 *   ("Filter by... (1)" for opening the filter dialog and pressing Submit).
 *
 * The pairing rule that used to live in a comment — *every filter counted must
 * be reset by the clear, or the menu offers a recovery that doesn't recover* —
 * is structural once both sides read this list.
 */
export interface Reversible {
  /** How many independent things this is holding. 0 = not in effect. */
  count: number
  /**
   * Row text for undoing just this one, given its count. Omit for state whose
   * only sensible undo is the group's "clear all" — a jexl filter list has no
   * per-item recovery to name.
   */
  label?: (count: number) => string
  icon?: React.ElementType
  /** Reverse it. Must be a no-op when `count` is 0. */
  clear: () => void
}

/**
 * A display's reversibles, keyed by name — `{ hiddenFeatures: {...}, solo: {...} }`.
 * A record rather than an array so a consumer wanting one specific entry (the
 * feature context menu offers "Show N hidden features" without the rest of the
 * family) reads `.hiddenFeatures` and is type-checked, instead of searching a
 * list for a string id. Row order is the record's insertion order.
 */
export type Reversibles = Record<string, Reversible>

/** Total in effect — what a "(n)" in a group label counts. */
export function activeCount(items: Reversibles) {
  return Object.values(items).reduce((a, b) => a + b.count, 0)
}

/**
 * Reverse every one. Inactive entries are cleared too (their `clear` is a
 * no-op), so this stays a plain fold rather than a filtered one — a caller
 * cannot half-clear by getting the gate wrong.
 */
export function clearAll(items: Reversibles) {
  for (const item of Object.values(items)) {
    item.clear()
  }
}

/**
 * The undo rows: one per entry that is in effect AND names itself. Spread,
 * don't insert — an entry holding nothing contributes nothing.
 */
export function undoItems(items: Reversibles, priority?: number): MenuItem[] {
  return Object.values(items)
    .filter(item => item.count > 0 && item.label)
    .map(item => ({
      label: item.label!(item.count),
      icon: item.icon,
      priority,
      onClick: () => {
        item.clear()
      },
    }))
}

export interface FilterMenuOpts {
  /**
   * The display's narrowings, declared once (see {@link Reversible}). Supplying
   * this derives `activeCount`, `recoveryItems` and `onClear` together, so the
   * count in the label, the rows inside the submenu and what "Clear all filters"
   * actually clears cannot disagree. Prefer it to spelling the three out.
   */
  narrowings?: Reversibles
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
   *
   * Ignored when `narrowings` is given.
   */
  activeCount?: number
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
  narrowings,
  activeCount: explicitCount = 0,
  onEdit,
  subItems = [],
  recoveryItems: explicitRecovery = [],
  onClear: explicitClear,
  priority,
  editLabel = 'Edit filters...',
}: FilterMenuOpts): MenuItem[] {
  // One declaration drives all three, or the caller supplies them separately —
  // the pre-`Reversible` shape, kept for the displays that haven't adopted it.
  const count = narrowings ? activeCount(narrowings) : explicitCount
  const recoveryItems = narrowings ? undoItems(narrowings) : explicitRecovery
  const onClear = narrowings
    ? () => {
        clearAll(narrowings)
      }
    : explicitClear
  const label = count > 0 ? `Filter by... (${count})` : 'Filter by...'
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
    onClear && count > 0
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

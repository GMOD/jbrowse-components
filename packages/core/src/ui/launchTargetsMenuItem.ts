import type { MenuItem } from './MenuTypes.ts'
import type { SvgIconComponent } from '@mui/icons-material'

/**
 * One launch offer, over the datasets that can serve it: nothing at all when
 * none can, otherwise a submenu naming each. Which dataset a launch reads from
 * changes the answer, so the name is always on screen — a single dataset gets
 * the same submenu as several rather than a flat item that leaves it unsaid.
 *
 * Kept apart from the discovery it is fed so the shape is testable on plain
 * data.
 */
export function launchTargetsMenuItem<T>({
  label,
  icon,
  entries,
  entryLabel,
  onSelect,
}: {
  label: string
  icon: SvgIconComponent
  entries: T[]
  entryLabel: (entry: T) => string
  onSelect: (entry: T) => () => void
}): MenuItem[] {
  return entries.length
    ? [
        {
          label,
          icon,
          type: 'subMenu',
          subMenu: entries.map(entry => ({
            label: entryLabel(entry),
            onClick: onSelect(entry),
          })),
        },
      ]
    : []
}

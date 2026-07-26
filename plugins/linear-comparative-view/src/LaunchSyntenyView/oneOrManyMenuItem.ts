import type { MenuItem } from '@jbrowse/core/ui'
import type { SvgIconComponent } from '@mui/icons-material'

// One launch offer per capable dataset, collapsed to the shape the count calls
// for: nothing at all when none can serve it, a flat item when exactly one can
// (a submenu of one is a needless extra click), and a submenu naming each when
// several can, since which dataset the new view is cut from is then a real
// choice rather than a formality.
//
// Kept apart from the discovery it is fed so this decision is testable on plain
// data. It is the same shape the graph-genome-view launcher settled on, and the
// rule that generalizes across "open another view on this region" entries.
export function oneOrManyMenuItem<T>({
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
  let items: MenuItem[] = []
  if (entries.length === 1) {
    items = [{ label, icon, onClick: onSelect(entries[0]!) }]
  } else if (entries.length > 1) {
    items = [
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
  }
  return items
}

export type SubmenuSide = 'left' | 'right'

// MUI Popover's default marginThreshold, the gap it keeps from the viewport edge
const viewportMargin = 16

// MUI never flips a Popover: it slides one that overflows back inside the
// viewport, on top of the menu it hangs off. A cascade keeps the side its parent
// turned toward, so it never doubles back over the menus it came from.
export function submenuSide(
  preferred: SubmenuSide,
  row: { left: number; right: number },
  panelWidth: number,
  viewportWidth: number,
) {
  const room = {
    left: row.left - viewportMargin,
    right: viewportWidth - viewportMargin - row.right,
  }
  const other = preferred === 'right' ? 'left' : 'right'
  return room[preferred] >= panelWidth || room[preferred] >= room[other]
    ? preferred
    : other
}

export function submenuOrigins(side: SubmenuSide) {
  return {
    anchorOrigin: { vertical: 'top', horizontal: side },
    transformOrigin: {
      vertical: 'top',
      horizontal: side === 'right' ? 'left' : 'right',
    },
  } as const
}

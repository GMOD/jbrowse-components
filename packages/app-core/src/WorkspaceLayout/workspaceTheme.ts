/**
 * The workspace chrome: tab strips, splitters and drop indicators.
 *
 * Fixed and dark in every JBrowse theme, the way the app bar is, so the frame
 * never reads as content. The cell body is not chrome and follows
 * `theme.palette.background.default` in `PanelView`.
 */
export const workspaceTheme = {
  stripBackground: '#252526',
  stripHeight: 35,
  stripFontSize: 13,
  tabDivider: '#1e1e1e',
  selectedTabBackground: '#1e1e1e',
  tabBackground: '#2d2d2d',
  iconHoverBackground: 'rgba(90, 93, 94, 0.31)',
  splitterLine: 'rgb(68, 68, 68)',
  /** grab area; the line drawn inside it is 1px */
  splitterSize: 4,
  dropWash: 'rgba(83, 89, 93, 0.5)',
  accent: 'rgba(56, 139, 253, 0.9)',
} as const

// the active cell's selected tab is the one fully white label on screen
const tabTextColors = {
  activeCell: { selected: 'white', other: '#969696' },
  otherCell: { selected: '#8f8f8f', other: '#626262' },
}

export function tabColors(cellActive: boolean, selected: boolean) {
  const text = cellActive ? tabTextColors.activeCell : tabTextColors.otherCell
  return {
    background: selected
      ? workspaceTheme.selectedTabBackground
      : workspaceTheme.tabBackground,
    color: selected ? text.selected : text.other,
  }
}

/** the panel actions' icons, which sit on the strip beside unselected tabs */
export const stripIconColor = tabTextColors.activeCell.other

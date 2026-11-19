import { makeStyles } from '../../util/tss-react/index.ts'
import { alpha } from '../palette.ts'

export const ROW_HEIGHT = 25
export const HEADER_HEIGHT = 35
export const CELL_PADDING = '0 10px'
export const DEFAULT_COL_WIDTH = 100
export const CHECKBOX_WIDTH = 40

export const useVirtualTableStyles = makeStyles()(theme => {
  const borderColor = theme.palette.tableBorder
  const border = `1px solid ${borderColor}`
  return {
    root: {
      height: '100%',
      width: '100%',
      overflow: 'auto',
      border,
      borderRadius: theme.shape.borderRadius,
      background: theme.palette.background.paper,
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.body2.fontSize,
      lineHeight: theme.typography.body2.lineHeight,
      color: theme.palette.text.primary,
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
    },
    thead: {
      position: 'sticky',
      top: 0,
      zIndex: 1,
      background: theme.palette.background.paper,
    },
    leadingCell: {
      padding: 0,
      textAlign: 'center',
      verticalAlign: 'middle',
      lineHeight: 0,
      borderBottom: border,
      boxSizing: 'border-box',
    },
    headerCell: {
      height: HEADER_HEIGHT,
      position: 'relative',
      textAlign: 'left',
      fontWeight: theme.typography.fontWeightMedium,
      padding: CELL_PADDING,
      borderBottom: border,
      overflow: 'hidden',
      userSelect: 'none',
      lineHeight: `${HEADER_HEIGHT}px`,
      verticalAlign: 'middle',
      boxSizing: 'border-box',
    },
    selectedRow: {
      background: alpha(
        theme.palette.accent,
        theme.palette.action.selectedOpacity,
      ),
    },
    clickableRow: {
      cursor: 'pointer',
      '&:hover': {
        background: theme.palette.action.hover,
      },
    },
    selectedClickableRow: {
      '&:hover': {
        background: alpha(
          theme.palette.accent,
          theme.palette.action.selectedOpacity +
            theme.palette.action.hoverOpacity,
        ),
      },
    },
    bodyCell: {
      padding: CELL_PADDING,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      borderBottom: border,
      boxSizing: 'border-box',
    },
    alignRight: {
      textAlign: 'right',
    },
    overhang: {
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
      height: 0,
    },
    headerContent: {
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      width: '100%',
      height: '100%',
    },
    sortButton: {
      padding: 0,
      border: 0,
      background: 'none',
      font: 'inherit',
      color: 'inherit',
      textAlign: 'left',
      cursor: 'pointer',
    },
    headerContentRight: {
      flexDirection: 'row-reverse',
    },
    headerLabel: {
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    sortIcon: {
      flexShrink: 0,
      fontSize: 16,
    },
    resizeHandle: {
      position: 'absolute',
      right: 0,
      top: 0,
      height: '100%',
      width: 10,
      display: 'flex',
      justifyContent: 'center',
      cursor: 'col-resize',
      touchAction: 'none',
    },
    resizeLine: {
      width: 1,
      height: '50%',
      alignSelf: 'center',
      background: borderColor,
    },
    emptyCell: {
      padding: 20,
      textAlign: 'left',
      color: theme.palette.text.secondary,
    },
  }
})

/* eslint-disable tss-unused-classes/unused-classes -- shared across the faceted table components */
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha, darken, lighten } from '@mui/material/styles'

export const ROW_HEIGHT = 25
export const HEADER_HEIGHT = 35
export const CHECKBOX_WIDTH = 48
export const DEFAULT_COL_WIDTH = 100

export const checkboxSx = {
  padding: 0,
  '& .MuiSvgIcon-root': { fontSize: '1.15rem' },
}

export const useFacetedTableStyles = makeStyles()(theme => {
  const borderColor =
    theme.palette.mode === 'light'
      ? lighten(alpha(theme.palette.divider, 1), 0.88)
      : darken(alpha(theme.palette.divider, 1), 0.68)
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
      minWidth: '100%',
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
    },
    thead: {
      position: 'sticky',
      top: 0,
      zIndex: 1,
      background: theme.palette.background.paper,
    },
    checkboxCell: {
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
      padding: '0 10px',
      borderBottom: border,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      userSelect: 'none',
      lineHeight: `${HEADER_HEIGHT}px`,
      verticalAlign: 'middle',
      boxSizing: 'border-box',
    },
    bodyRow: {
      '&:hover': {
        background: theme.palette.action.hover,
      },
    },
    selectedRow: {
      background: alpha(
        theme.palette.primary.main,
        theme.palette.action.selectedOpacity,
      ),
      '&:hover': {
        background: alpha(
          theme.palette.primary.main,
          theme.palette.action.selectedOpacity +
            theme.palette.action.hoverOpacity,
        ),
      },
    },
    bodyCell: {
      height: ROW_HEIGHT,
      padding: '0 10px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      borderBottom: border,
      lineHeight: `${ROW_HEIGHT - 1}px`,
      boxSizing: 'border-box',
    },
    resizeHandle: {
      position: 'absolute',
      right: 0,
      top: '25%',
      height: '50%',
      width: 10,
      display: 'flex',
      justifyContent: 'center',
      cursor: 'col-resize',
    },
    resizeLine: {
      width: 1,
      height: '100%',
      background: borderColor,
    },
    fillerCell: {
      borderBottom: border,
      padding: 0,
    },
    emptyCell: {
      padding: 20,
      textAlign: 'center',
      color: theme.palette.text.secondary,
    },
  }
})

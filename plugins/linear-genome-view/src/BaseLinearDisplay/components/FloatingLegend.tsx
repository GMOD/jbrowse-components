import { useState } from 'react'

import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(theme => ({
  legend: {
    position: 'absolute',
    right: 10,
    top: 10,
    background: theme.palette.background.paper,
    padding: 3,
    fontSize: 10,
    zIndex: 100,
    maxWidth: 200,
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  withClose: {
    paddingRight: 20,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 1,
    '&:last-child': {
      marginBottom: 0,
    },
  },
  colorBox: {
    width: 12,
    height: 12,
    marginRight: 6,
    flexShrink: 0,
  },
  label: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  toggle: {
    cursor: 'pointer',
    marginTop: 2,
    display: 'block',
    fontSize: 10,
  },
}))

const DEFAULT_MAX_ITEMS = 12

export interface LegendItem {
  color?: string
  label: string
}

const FloatingLegend = observer(function FloatingLegend({
  items,
  onDismiss,
  maxItems = DEFAULT_MAX_ITEMS,
}: {
  items: LegendItem[]
  onDismiss?: () => void
  maxItems?: number
}) {
  const { classes } = useStyles()
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) {
    return null
  }

  const collapsible = items.length > maxItems
  const shown = collapsible && !expanded ? items.slice(0, maxItems) : items
  const hiddenCount = items.length - maxItems

  return (
    <div className={cx(classes.legend, onDismiss && classes.withClose)}>
      {onDismiss ? (
        <IconButton
          className={classes.closeButton}
          size="small"
          title="Hide legend"
          onClick={() => {
            onDismiss()
          }}
        >
          <CloseIcon fontSize="inherit" />
        </IconButton>
      ) : null}
      {shown.map(item => (
        <div key={item.label} className={classes.item}>
          <div
            className={classes.colorBox}
            style={{ backgroundColor: item.color }}
          />
          <span className={classes.label}>{item.label}</span>
        </div>
      ))}
      {collapsible ? (
        <Link
          component="button"
          underline="hover"
          className={classes.toggle}
          onClick={() => {
            setExpanded(!expanded)
          }}
        >
          {expanded ? 'Show less' : `Show ${hiddenCount} more…`}
        </Link>
      ) : null}
    </div>
  )
})

export default FloatingLegend

import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import IconButton from '@mui/material/IconButton'
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
}))

export interface LegendItem {
  color?: string
  label: string
}

const FloatingLegend = observer(function FloatingLegend({
  items,
  onDismiss,
}: {
  items: LegendItem[]
  onDismiss?: () => void
}) {
  const { classes } = useStyles()

  if (items.length === 0) {
    return null
  }

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
      {items.map((item, idx) => (
        <div key={`${item.label}-${idx}`} className={classes.item}>
          <div
            className={classes.colorBox}
            style={{ backgroundColor: item.color }}
          />
          <span className={classes.label}>{item.label}</span>
        </div>
      ))}
    </div>
  )
})

export default FloatingLegend

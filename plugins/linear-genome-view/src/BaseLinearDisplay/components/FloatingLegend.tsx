import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  legend: {
    position: 'absolute',
    right: 10,
    top: 10,
    background: 'rgba(255,255,255,0.4)',
    padding: 3,
    fontSize: 10,
    pointerEvents: 'none',
    zIndex: 100,
    maxWidth: 200,
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
})

export interface LegendItem {
  color?: string
  label: string
}

const FloatingLegend = observer(function FloatingLegend({
  items,
}: {
  items: LegendItem[]
}) {
  const { classes } = useStyles()

  if (items.length === 0) {
    return null
  }

  return (
    <div className={classes.legend}>
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

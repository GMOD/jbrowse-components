import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { LD_LEGEND } from '../ldBins.ts'

const useStyles = makeStyles()({
  container: {
    position: 'absolute',
    right: 4,
    background: 'rgba(255,255,255,0.85)',
    border: '1px solid #ccc',
    borderRadius: 3,
    padding: '2px 5px',
    fontSize: 10,
    lineHeight: 1.4,
    pointerEvents: 'none',
  },
  title: {
    fontWeight: 'bold',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
  },
  swatch: {
    display: 'inline-block',
    width: 10,
    height: 10,
    marginRight: 4,
    border: '1px solid rgba(0,0,0,0.2)',
  },
})

// LocusZoom-style r² key, shown when the display colors points by LD to the
// index SNP. Positioned top-right over the plot, like LocusZoom.
const LdColorLegend = observer(function LdColorLegend({
  offsetTop,
}: {
  offsetTop: number
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.container} style={{ top: offsetTop + 2 }}>
      <div className={classes.title}>r² to index</div>
      {LD_LEGEND.map(({ label, color }) => (
        <div key={label} className={classes.row}>
          <span className={classes.swatch} style={{ background: color }} />
          {label}
        </div>
      ))}
    </div>
  )
})

export default LdColorLegend

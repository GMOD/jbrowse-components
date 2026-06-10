import CloseIcon from '@mui/icons-material/Close'
import IconButton from '@mui/material/IconButton'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { LD_LEGEND } from '../ldBins.ts'

const useStyles = makeStyles()(theme => ({
  container: {
    position: 'absolute',
    right: 4,
    background: 'rgba(255,255,255,0.85)',
    border: '1px solid #ccc',
    borderRadius: 3,
    padding: '2px 5px',
    fontSize: 10,
    lineHeight: 1.4,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
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
}))

// LocusZoom-style r² key, shown when the display colors points by LD to the
// index SNP. Positioned top-right over the plot, like LocusZoom.
const LdColorLegend = observer(function LdColorLegend({
  offsetTop,
  onDismiss,
}: {
  offsetTop: number
  onDismiss?: () => void
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.container} style={{ top: offsetTop + 2 }}>
      <div className={classes.header}>
        <div className={classes.title}>r² to index</div>
        {onDismiss ? (
          <IconButton
            size="small"
            title="Hide legend"
            onClick={() => {
              onDismiss()
            }}
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        ) : null}
      </div>
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

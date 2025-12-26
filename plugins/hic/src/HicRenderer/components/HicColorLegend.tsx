import { makeStyles } from '@jbrowse/core/util/tss-react'
import { scaleLinear, scaleLog } from '@mui/x-charts-vendor/d3-scale'
import { observer } from 'mobx-react'
import { toLocale } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  legend: {
    position: 'absolute',
    right: 10,
    top: 10,
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid #ccc',
    borderRadius: 4,
    padding: 8,
    fontSize: 11,
    pointerEvents: 'none',
    zIndex: 100,
  },
  gradientBar: {
    width: 100,
    height: 12,
    marginBottom: 4,
    borderRadius: 2,
  },
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
  },
})

const colorGradients: Record<string, string> = {
  juicebox: 'linear-gradient(to right, rgba(0,0,0,0), red)',
  fall: 'linear-gradient(to right, rgb(255,255,255), rgb(255,255,204), rgb(255,237,160), rgb(254,217,118), rgb(254,178,76), rgb(253,141,60), rgb(252,78,42), rgb(227,26,28), rgb(189,0,38), rgb(128,0,38), rgb(0,0,0))',
  viridis:
    'linear-gradient(to right, #440154, #482878, #3e4a89, #31688e, #26828e, #1f9e89, #35b779, #6ece58, #b5de2b, #fde725)',
}

function getNiceScale(maxScore: number, useLogScale?: boolean) {
  if (useLogScale) {
    const scale = scaleLog().domain([1, maxScore]).nice()
    const [min, max] = scale.domain()
    return { min, max }
  }
  const scale = scaleLinear().domain([0, maxScore]).nice()
  const [min, max] = scale.domain()
  return { min, max }
}

const HicColorLegend = observer(function HicColorLegend({
  maxScore,
  colorScheme = 'juicebox',
  useLogScale,
}: {
  maxScore: number
  colorScheme?: string
  useLogScale?: boolean
}) {
  const { classes } = useStyles()
  const gradient = colorGradients[colorScheme] || colorGradients.juicebox
  const { min, max } = getNiceScale(maxScore, useLogScale)

  return (
    <div className={classes.legend}>
      <div className={classes.gradientBar} style={{ background: gradient }} />
      <div className={classes.labels}>
        <span>{min !== undefined ? toLocale(min) : ''}</span>
        <span>
          {max !== undefined ? toLocale(max) : ''}
          {useLogScale ? ' (log)' : ''}
        </span>
      </div>
    </div>
  )
})

export default HicColorLegend

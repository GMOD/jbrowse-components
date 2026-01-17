import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()({
  legend: {
    position: 'absolute',
    top: 4,
    right: 4,
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid #ccc',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 11,
  },
  legendGradient: {
    width: 100,
    height: 12,
    marginBottom: 2,
  },
  legendLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
  },
})

export default function LDColorLegend({ ldMetric }: { ldMetric: string }) {
  const { classes } = useStyles()

  // Create gradient style based on metric
  const gradientStyle =
    ldMetric === 'dprime'
      ? 'linear-gradient(to right, white, #8080ff, #0000a0)'
      : 'linear-gradient(to right, white, #ff8080, #a00000)'

  return (
    <div className={classes.legend}>
      <div
        className={classes.legendGradient}
        style={{ background: gradientStyle }}
      />
      <div className={classes.legendLabels}>
        <span>0</span>
        <span>{ldMetric === 'dprime' ? "D'" : 'R²'}</span>
        <span>1</span>
      </div>
    </div>
  )
}

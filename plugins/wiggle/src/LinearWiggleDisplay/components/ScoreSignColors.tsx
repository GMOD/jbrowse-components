import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(theme => ({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  swatch: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
}))

// Display-level (not per-source) score-sign colors: which color a bar gets on
// each side of the pivot. Deliberately low-key and deliberately just the two
// swatches — most multi-wiggle data is unsigned, where only `posColor` is even
// consulted, and then only as the fallback for a source with no color of its
// own. Writes the model directly, so unlike the grid there is nothing to Submit.
const ScoreSignColors = observer(function ScoreSignColors({
  model,
}: {
  model: {
    posColor: string
    negColor: string
    setPosColor: (arg?: string) => void
    setNegColor: (arg?: string) => void
  }
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.row}>
      <Typography variant="caption" color="textSecondary">
        Score sign colors
      </Typography>
      <div className={classes.swatch}>
        <PopoverPicker
          color={model.posColor}
          onChange={color => {
            model.setPosColor(color)
          }}
        />
        <Typography variant="caption">Positive</Typography>
      </div>
      <div className={classes.swatch}>
        <PopoverPicker
          color={model.negColor}
          onChange={color => {
            model.setNegColor(color)
          }}
        />
        <Typography variant="caption">Negative</Typography>
      </div>
    </div>
  )
})

export default ScoreSignColors

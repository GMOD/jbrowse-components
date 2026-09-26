import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  line: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    marginBottom: theme.spacing(1),
  },
  // PopoverPicker's trigger swatch, minus the click
  read: { width: 24, height: 24, margin: 4 },
}))

/**
 * The display's own colour, on one line above the rows: the two colours its
 * plot is drawn in, either side of where it parts. One line rather than a panel
 * because the rows below are what a reader opens this dialog for.
 */
export default function PlotColorRow({
  above,
  below,
  editable,
  reason,
  onChange,
}: {
  above: string
  below: string
  editable: boolean
  /** What paints instead, where two colours cannot say the picture. */
  reason?: string
  onChange: (next: { above: string; below: string }) => void
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.line} data-testid="plot-color-row">
      <Typography variant="body2" color="textSecondary">
        Plot
      </Typography>
      {editable ? (
        <>
          <PopoverPicker
            color={above}
            onChange={next => {
              onChange({ above: next, below })
            }}
          />
          <PopoverPicker
            color={below}
            onChange={next => {
              onChange({ above, below: next })
            }}
          />
        </>
      ) : (
        Object.entries({ above, below }).map(([side, color]) => (
          <div
            key={side}
            className={classes.read}
            style={{ backgroundColor: color }}
          />
        ))
      )}
      <Typography variant="body2" color="textSecondary">
        {reason ?? 'above and below the baseline'}
      </Typography>
    </div>
  )
}

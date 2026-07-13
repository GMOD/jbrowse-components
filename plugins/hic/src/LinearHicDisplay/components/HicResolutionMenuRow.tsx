import { getBpDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { observer } from 'mobx-react'

// The subset of the model this interactive menu row drives. Kept structural so
// it stays decoupled from the full display model (avoids a model<->menu import
// cycle) while remaining fully typed.
interface ResolutionModel {
  resolutionBias: number
  effectiveResolution: number | undefined
  nextResolution: (dir: -1 | 1) => number | undefined
  stepResolution: (dir: -1 | 1) => void
  resetResolutionBias: () => void
}

const useStyles = makeStyles()(theme => ({
  root: {
    minWidth: 180,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  label: {
    flex: 1,
  },
  buttons: {
    display: 'flex',
    gap: theme.spacing(0.5),
  },
  button: {
    flex: 1,
  },
}))

// One direction of the resolution stepper. Observer so its disabled state
// tracks `nextResolution` as the zoom changes while the menu stays open.
const StepResolutionButton = observer(function StepResolutionButton({
  model,
  dir,
  label,
}: {
  model: ResolutionModel
  dir: -1 | 1
  label: string
}) {
  const { classes } = useStyles()
  return (
    <Button
      size="small"
      variant="outlined"
      className={classes.button}
      disabled={model.nextResolution(dir) === undefined}
      onClick={() => {
        model.stepResolution(dir)
      }}
    >
      {label}
    </Button>
  )
})

// Interactive resolution stepper rendered as a `type: 'custom'` track-menu row
// (like `makeSizeMenu`): the menu stays open while clicking Finer/Coarser, so
// resolution can be stepped repeatedly without reopening. Replaces the old
// on-canvas stepper overlay. Reads the model live via observer so the label and
// disabled states track the current zoom.
const HicResolutionMenuRow = observer(function HicResolutionMenuRow({
  model,
}: {
  model: ResolutionModel
}) {
  const { classes } = useStyles()
  const { resolutionBias, effectiveResolution } = model
  const isAuto = resolutionBias === 0
  const biasSuffix = isAuto
    ? ' (auto)'
    : ` (${resolutionBias > 0 ? '+' : '−'}${Math.abs(resolutionBias)})`
  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <Typography
          variant="caption"
          color="textSecondary"
          className={classes.label}
        >
          Resolution:{' '}
          {effectiveResolution !== undefined
            ? getBpDisplayStr(effectiveResolution)
            : '…'}
          {biasSuffix}
        </Typography>
        <Tooltip title="Reset to auto (tracks zoom)">
          <span>
            <IconButton
              size="small"
              disabled={isAuto}
              onClick={() => {
                model.resetResolutionBias()
              }}
            >
              <RestartAltIcon fontSize="inherit" />
            </IconButton>
          </span>
        </Tooltip>
      </div>
      <div className={classes.buttons}>
        <StepResolutionButton model={model} dir={1} label="Coarser" />
        <StepResolutionButton model={model} dir={-1} label="Finer" />
      </div>
    </div>
  )
})

export default HicResolutionMenuRow

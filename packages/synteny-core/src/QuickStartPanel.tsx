import { useId } from 'react'

import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const useStyles = makeStyles()(theme => ({
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2.5),
  },
  // the form is a short one, so let the Select stop at a readable width instead
  // of stretching across a wide window away from everything it controls
  track: {
    marginBottom: theme.spacing(1),
    maxWidth: 500,
  },
  emptyText: {
    marginBottom: theme.spacing(1),
  },
  launch: {
    marginTop: theme.spacing(1),
  },
}))

/**
 * Quick start: launch straight from a pre-configured synteny track, which names
 * its own assemblies. The track Select, the empty state and Launch are shared by
 * the linear synteny and dotplot import forms; `children` is the view's summary
 * of the assemblies the chosen track implies (rows for synteny, X/Y for
 * dotplot), which is the only part that differs.
 *
 * Unlike the selector this replaced, the Select holds its value: the assemblies
 * it implies are shown here rather than written into a separate form below, so
 * the control's effect is visible where the control is.
 */
const QuickStartPanel = observer(function QuickStartPanel({
  model,
  tracks,
  trackId,
  onChange,
  onLaunch,
  onSwap,
  onSwitchToManual,
  swapTitle,
  children,
}: {
  // only read for getSession, so node-ness is the whole requirement.
  // IStateTreeNode rather than IAnyStateTreeNode, which resolves to `any`
  model: IStateTreeNode
  tracks: AnyConfigurationModel[]
  trackId: string
  onChange: (trackId: string) => void
  onLaunch: () => void
  onSwap: () => void
  onSwitchToManual: () => void
  swapTitle: string
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  // two views can have an import form open at once, so a fixed id would point
  // the label at whichever Select rendered first
  const labelId = useId()
  return tracks.length ? (
    <div>
      <FormControl fullWidth className={classes.track}>
        <InputLabel id={labelId}>Synteny track</InputLabel>
        <Select
          labelId={labelId}
          label="Synteny track"
          value={trackId}
          onChange={event => {
            onChange(event.target.value)
          }}
        >
          {tracks.map(track => (
            <MenuItem key={track.trackId} value={track.trackId}>
              {getTrackName(track, session)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <div className={classes.summary}>
        {children}
        <Tooltip title={swapTitle}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<SwapVertIcon />}
            onClick={() => {
              onSwap()
            }}
          >
            Swap
          </Button>
        </Tooltip>
      </div>
      <Button
        className={classes.launch}
        onClick={() => {
          onLaunch()
        }}
        variant="contained"
        color="primary"
      >
        Launch
      </Button>
    </div>
  ) : (
    // the way out is a button rather than an instruction to go press one: Quick
    // start with nothing to launch is a dead end, and the panel is where the
    // user already is
    <div>
      <Typography color="text.secondary" className={classes.emptyText}>
        No synteny tracks are configured in this session.
      </Typography>
      <Button
        variant="outlined"
        onClick={() => {
          onSwitchToManual()
        }}
      >
        Pick assemblies manually
      </Button>
    </div>
  )
})

export default QuickStartPanel

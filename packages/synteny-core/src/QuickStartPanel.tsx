import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import {
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const useStyles = makeStyles()({
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },
})

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
  swapTitle,
  submitting,
  children,
}: {
  model: IAnyStateTreeNode
  tracks: AnyConfigurationModel[]
  trackId: string
  onChange: (trackId: string) => void
  onLaunch: () => void
  onSwap: () => void
  swapTitle: string
  submitting: boolean
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  return tracks.length ? (
    <div>
      <FormControl fullWidth style={{ marginBottom: 10 }}>
        <InputLabel id="quick-start-track-label">Synteny track</InputLabel>
        <Select
          labelId="quick-start-track-label"
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
        style={{ marginTop: 10 }}
        disabled={submitting}
        startIcon={
          submitting ? (
            <CircularProgress size={16} color="inherit" />
          ) : undefined
        }
        onClick={() => {
          onLaunch()
        }}
        variant="contained"
        color="primary"
      >
        {submitting ? 'Launching…' : 'Launch'}
      </Button>
    </div>
  ) : (
    <Typography color="text.secondary">
      No synteny tracks are configured in this session. Switch to Manual to pick
      assemblies and open a synteny file.
    </Typography>
  )
})

export default QuickStartPanel

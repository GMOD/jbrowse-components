import { makeStyles } from '@jbrowse/core/util/tss-react'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import { Button, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import SyntenyTrackChoice from './SyntenyTrackChoice.tsx'

import type { AnyTrackConfig } from '@jbrowse/core/configuration'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const useStyles = makeStyles()(theme => ({
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
  },
  emptyText: {
    marginBottom: theme.spacing(1),
  },
}))

/**
 * Quick start: launch straight from a pre-configured synteny track, which names
 * its own assemblies. The track picker, the empty state and Launch are shared by
 * the synteny import forms; `children` is the view's summary of the assemblies
 * the chosen track implies (rows, X/Y axes, a circle's genomes), which is the
 * only part that differs.
 *
 * Unlike the selector this replaced, the picker holds its value: the assemblies
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
  swapLabel,
  children,
}: {
  // only read for getSession, so node-ness is the whole requirement.
  // IStateTreeNode rather than IAnyStateTreeNode, which resolves to `any`
  model: IStateTreeNode
  tracks: AnyTrackConfig[]
  trackId: string
  onChange: (trackId: string) => void
  onLaunch: () => void
  onSwap: () => void
  onSwitchToManual: () => void
  swapTitle: string
  swapLabel: string
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  return tracks.length ? (
    <div>
      <SyntenyTrackChoice
        model={model}
        tracks={tracks}
        value={trackId}
        onChange={onChange}
      />
      {children}
      <div className={classes.actions}>
        <Button
          onClick={() => {
            onLaunch()
          }}
          variant="contained"
          color="primary"
        >
          Launch
        </Button>
        <Tooltip title={swapTitle}>
          <Button
            variant="outlined"
            startIcon={<SwapVertIcon />}
            onClick={() => {
              onSwap()
            }}
          >
            {swapLabel}
          </Button>
        </Tooltip>
      </div>
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

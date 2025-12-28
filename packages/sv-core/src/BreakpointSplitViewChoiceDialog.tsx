import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  Button,
  DialogActions,
  DialogContent,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import Checkbox2 from './Checkbox2'
import { navToMultiLevelBreak } from './navToMultiLevelBreak'
import { navToSingleLevelBreak } from './navToSingleLevelBreak'

import type { Track } from './types'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function SplitLevelIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <rect x="2" y="3" width="20" height="8" rx="1" fill="currentColor" />
      <rect x="2" y="13" width="20" height="8" rx="1" fill="currentColor" />
    </svg>
  )
}

function SingleLevelIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <rect x="2" y="8" width="20" height="8" rx="1" fill="currentColor" />
    </svg>
  )
}

const BreakpointSplitViewChoiceDialog = observer(
  function BreakpointSplitViewChoiceDialog({
    session,
    handleClose,
    feature,
    assemblyName,
    stableViewId,
    view,
  }: {
    session: AbstractSessionModel
    handleClose: () => void
    feature: Feature
    view?: LinearGenomeViewModel
    assemblyName: string
    stableViewId?: string
  }) {
    const [step, setStep] = useState<'choose' | 'options'>('choose')
    const [viewType, setViewType] = useState<'split' | 'single'>('split')
    const [copyTracks, setCopyTracks] = useState(true)
    const [mirror, setMirror] = useState(true)
    const [focusOnBreakends, setFocusOnBreakends] = useState(true)
    const [windowSize, setWindowSize] = useLocalStorage(
      'breakpointWindowSize',
      '5000',
    )

    const isSplitLevel = viewType === 'split'

    const handleLaunch = () => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      ;(async () => {
        try {
          await (isSplitLevel
            ? navToMultiLevelBreak({
                stableViewId: stableViewId
                  ? `${stableViewId}_multilevel`
                  : undefined,
                session,
                tracks:
                  copyTracks && view
                    ? (getSnapshot(view.tracks) as Track[])
                    : [],
                mirror,
                feature,
                assemblyName,
                windowSize: +windowSize || 0,
              })
            : navToSingleLevelBreak({
                feature,
                assemblyName,
                focusOnBreakends,
                session,
                stableViewId: stableViewId
                  ? `${stableViewId}_singlelevel`
                  : undefined,
                tracks: copyTracks ? view?.tracks : undefined,
                windowSize: +windowSize || 0,
              }))
        } catch (e) {
          console.error(e)
          session.notifyError(`${e}`, e)
        }
      })()
      handleClose()
    }

    if (step === 'choose') {
      return (
        <Dialog open onClose={handleClose} title="Open breakpoint split view">
          <DialogContent>
            <List>
              <ListItemButton
                onClick={() => {
                  setViewType('split')
                  setStep('options')
                }}
              >
                <ListItemIcon>
                  <SplitLevelIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Split level (top/bottom)"
                  secondary="Opens two stacked linear genome views, one for each breakend"
                />
              </ListItemButton>
              <ListItemButton
                onClick={() => {
                  setViewType('single')
                  setStep('options')
                }}
              >
                <ListItemIcon>
                  <SingleLevelIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Single level (single row)"
                  secondary="Opens one linear genome view spanning both breakends"
                />
              </ListItemButton>
            </List>
          </DialogContent>
        </Dialog>
      )
    }

    return (
      <Dialog
        open
        onClose={handleClose}
        title={
          isSplitLevel
            ? 'Split level options'
            : 'Single level options'
        }
      >
        <DialogContent>
          {view ? (
            <Checkbox2
              checked={copyTracks}
              label="Copy tracks into the new view"
              onChange={event => {
                setCopyTracks(event.target.checked)
              }}
            />
          ) : null}

          {isSplitLevel ? (
            view && copyTracks ? (
              <Checkbox2
                checked={mirror}
                label="Mirror the copied tracks"
                onChange={event => {
                  setMirror(event.target.checked)
                }}
              />
            ) : null
          ) : (
            <Checkbox2
              checked={focusOnBreakends}
              label="Focus on breakends"
              onChange={event => {
                setFocusOnBreakends(event.target.checked)
              }}
            />
          )}

          <TextField
            label="Window size (bp)"
            value={windowSize}
            onChange={event => {
              setWindowSize(event.target.value)
            }}
            size="small"
            style={{ marginTop: 8, display: 'block' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStep('choose')}>Back</Button>
          <Button variant="contained" color="primary" onClick={handleLaunch}>
            Open
          </Button>
          <Button variant="contained" color="secondary" onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    )
  },
)

export default BreakpointSplitViewChoiceDialog

import { useState } from 'react'

import { Dialog, LabeledCheckbox } from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util/hooks'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  Button,
  DialogActions,
  DialogContent,
  FormGroup,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import { navToMultiLevelBreak } from './navToMultiLevelBreak.ts'
import { navToSingleLevelBreak } from './navToSingleLevelBreak.ts'

import type { Track } from './types.ts'
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
      const tracks =
        copyTracks && view ? (getSnapshot(view.tracks) as Track[]) : []
      const windowSizeNum = Number(windowSize) || 0
      const suffixedId = (suffix: string) =>
        stableViewId === undefined ? undefined : `${stableViewId}_${suffix}`
      void (async () => {
        try {
          await (isSplitLevel
            ? navToMultiLevelBreak({
                stableViewId: suffixedId('multilevel'),
                session,
                tracks,
                mirror,
                feature,
                assemblyName,
                windowSize: windowSizeNum,
              })
            : navToSingleLevelBreak({
                feature,
                assemblyName,
                focusOnBreakends,
                session,
                stableViewId: suffixedId('singlelevel'),
                tracks,
                windowSize: windowSizeNum,
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
        title={isSplitLevel ? 'Split level options' : 'Single level options'}
      >
        <DialogContent>
          <FormGroup>
            {view ? (
              <LabeledCheckbox
                checked={copyTracks}
                label="Copy tracks into the new view"
                onChange={val => {
                  setCopyTracks(val)
                }}
              />
            ) : null}

            {isSplitLevel ? (
              view && copyTracks ? (
                <LabeledCheckbox
                  checked={mirror}
                  label="Mirror the copied tracks"
                  onChange={val => {
                    setMirror(val)
                  }}
                />
              ) : null
            ) : (
              <LabeledCheckbox
                checked={focusOnBreakends}
                label="Focus on breakends"
                onChange={val => {
                  setFocusOnBreakends(val)
                }}
              />
            )}
          </FormGroup>

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
          <Button
            variant="contained"
            onClick={() => {
              setStep('choose')
            }}
          >
            Back
          </Button>
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

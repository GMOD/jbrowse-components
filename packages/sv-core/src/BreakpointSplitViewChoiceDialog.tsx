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
import { junctionFromFeature, walkBreakendChain } from './walkBreakendChain.ts'

import type { Track } from './types.ts'
import type { BreakpointSplitViewHost } from './util.ts'
import type { FindJunctionsNear } from './walkBreakendChain.ts'
import type { Feature } from '@jbrowse/core/util'
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
    findJunctionsNear,
    defaultTrackIds,
  }: {
    session: BreakpointSplitViewHost
    handleClose: () => void
    feature: Feature
    view?: LinearGenomeViewModel
    assemblyName: string
    stableViewId?: string
    findJunctionsNear?: FindJunctionsNear
    defaultTrackIds?: string[]
  }) {
    // ONE STEP. This dialog used to ask its two questions on two screens --
    // shape, then options -- so opening a split view took a right-click, a menu
    // item and two more clicks before anything was launched, and the shape
    // chosen on screen one was no longer visible on screen two. There is no
    // dependency between the two questions that needs the sequencing: `mirror`
    // and `focusOnBreakends` are the only shape-specific rows and they swap in
    // place. So the shapes are a selectable pair at the top of the same dialog
    // the options and the Open button live in, and the choice stays on screen
    // while it is being configured.
    const [viewType, setViewType] = useState<'split' | 'single'>('split')
    const [copyTracks, setCopyTracks] = useState(true)
    const [mirror, setMirror] = useState(true)
    const [focusOnBreakends, setFocusOnBreakends] = useState(true)
    // A record describes one junction, and a rearrangement is often several that
    // leave from each other's loci. Default ON where it is offered at all: the
    // walk stops on its own at a locus with nothing else there, so on an
    // isolated translocation it changes nothing, and where it does add a panel
    // that panel is part of the same shape.
    const [followChain, setFollowChain] = useState(true)
    const [windowSize, setWindowSize] = useLocalStorage(
      'breakpointWindowSize',
      '5000',
    )

    const isSplitLevel = viewType === 'split'
    // Only for the stacked shape. A single-level view lays its loci along one
    // row, so a third one is more of the row rather than another panel, and
    // `navToSingleLevelBreak` frames the record's own pair.
    const canFollowChain = findJunctionsNear !== undefined && isSplitLevel

    const handleLaunch = () => {
      // `undefined`, not `[]`, when there is no view to copy from: the two are
      // different answers to "what tracks should this view have", and only the
      // second one is the reader's. A relaunch rebuilds for the reader's answer
      // and re-navigates for the absent one — see `openOrReuseSplitView`.
      const tracks = view
        ? copyTracks
          ? (getSnapshot(view.tracks) as Track[])
          : []
        : undefined
      const windowSizeNum = Number(windowSize) || 0
      const suffixedId = (suffix: string) =>
        stableViewId === undefined ? undefined : `${stableViewId}_${suffix}`
      void (async () => {
        try {
          const start =
            canFollowChain && followChain
              ? junctionFromFeature(
                  feature,
                  await session.assemblyManager.requireAssembly(assemblyName),
                )
              : undefined
          const stops =
            start && findJunctionsNear
              ? await walkBreakendChain({ start, findJunctionsNear })
              : undefined
          await (isSplitLevel
            ? navToMultiLevelBreak({
                stableViewId: suffixedId('multilevel'),
                session,
                tracks,
                defaultTrackIds,
                mirror,
                feature,
                assemblyName,
                windowSize: windowSizeNum,
                stops,
              })
            : navToSingleLevelBreak({
                feature,
                assemblyName,
                focusOnBreakends,
                session,
                stableViewId: suffixedId('singlelevel'),
                tracks,
                defaultTrackIds,
                windowSize: windowSizeNum,
              }))
        } catch (e) {
          console.error(e)
          session.notifyError(`${e}`, e)
        }
      })()
      handleClose()
    }

    return (
      <Dialog open onClose={handleClose} title="Open breakpoint split view">
        <DialogContent>
          <List>
            <ListItemButton
              selected={isSplitLevel}
              onClick={() => {
                setViewType('split')
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
              selected={!isSplitLevel}
              onClick={() => {
                setViewType('single')
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

            {canFollowChain ? (
              <LabeledCheckbox
                checked={followChain}
                label="Follow further breakends at each end"
                onChange={val => {
                  setFollowChain(val)
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

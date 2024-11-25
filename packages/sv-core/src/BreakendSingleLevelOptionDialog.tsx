import React, { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import {
  gatherOverlaps,
  getSession,
  useLocalStorage,
  when,
} from '@jbrowse/core/util'
import { Button, DialogActions, DialogContent, TextField } from '@mui/material'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'

// types
import Checkbox2 from './Checkbox2'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals

interface Display {
  id: string
  [key: string]: unknown
}
interface Track {
  id: string
  displays: Display[]
  [key: string]: unknown
}

function stripIds(arr: Track[]) {
  return arr.map(({ id, displays, ...rest }) => ({
    ...rest,
    displays: displays.map(({ id, ...rest }) => rest),
  }))
}

const BreakendSingleLevelOptionDialog = observer(function ({
  session,
  handleClose,
  feature,
  stableViewId,
  assemblyName,
  viewType,
  view,
}: {
  session: AbstractSessionModel
  handleClose: () => void
  stableViewId?: string
  feature: Feature
  view?: LinearGenomeViewModel
  assemblyName: string
  viewType: {
    singleLevelSnapshotFromBreakendFeature: (arg: {
      feature: Feature
      assemblyName: string
      session: AbstractSessionModel
    }) => any
  }
}) {
  const [copyTracks, setCopyTracks] = useState(true)
  const [windowSize, setWindowSize] = useLocalStorage(
    'breakpointWindowSize',
    '5000',
  )

  return (
    <Dialog
      open
      onClose={handleClose}
      title="Single-level breakpoint split view options"
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

        <TextField
          label="Window size (bp)"
          value={windowSize}
          onChange={event => {
            setWindowSize(event.target.value)
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                const { assemblyManager } = session
                const assembly =
                  await assemblyManager.waitForAssembly(assemblyName)
                if (!assembly) {
                  throw new Error(`assembly ${assemblyName} not found`)
                }
                const w = +windowSize
                if (Number.isNaN(w)) {
                  throw new Error('windowSize not a number')
                }
                const { snap, coverage } =
                  viewType.singleLevelSnapshotFromBreakendFeature({
                    feature,
                    assemblyName,
                    session,
                  })
                const {
                  refName,
                  pos: startPos,
                  mateRefName,
                  matePos: endPos,
                } = coverage
                let viewInStack = session.views.find(
                  f => f.id === stableViewId,
                ) as { views: LinearGenomeViewModel[] } | undefined

                if (!viewInStack) {
                  viewInStack = session.addView('BreakpointSplitView', {
                    ...snap,
                    views: [
                      {
                        ...snap.views[0],
                        tracks: view?.tracks
                          ? stripIds(getSnapshot(view.tracks))
                          : [],
                      },
                    ],
                  }) as unknown as { views: LinearGenomeViewModel[] }
                } else {
                  viewInStack.views[0]?.setDisplayedRegions(
                    snap.views[0].displayedRegions,
                  )
                  // @ts-expect-error
                  viewInStack.setDisplayName(snap.displayName)
                }
                const lgv = viewInStack.views[0]!
                await when(() => lgv.initialized)
                console.log(
                  'wtf',
                  snap,
                  view?.displayedRegions,
                  startPos,
                  endPos,
                  refName,
                  mateRefName,
                )
                const l0 = lgv.bpToPx({
                  coord: Math.max(0, startPos - w),
                  refName,
                })
                const r0 = lgv.bpToPx({
                  coord: endPos + w,
                  refName: mateRefName,
                })
                console.log({ l0, r0 })
                if (l0 && r0) {
                  lgv.moveTo(
                    { ...l0, offset: l0.offsetPx },
                    { ...r0, offset: r0.offsetPx },
                  )
                } else {
                  getSession(lgv).notify('Unable to navigate to breakpoint')
                }
              } catch (e) {
                console.error(e)
                session.notifyError(`${e}`, e)
              }
            })()
            handleClose()
          }}
          variant="contained"
          color="primary"
          autoFocus
        >
          OK
        </Button>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default BreakendSingleLevelOptionDialog

import React, { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { gatherOverlaps, useLocalStorage } from '@jbrowse/core/util'
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
    getBreakendCoveringRegions: (arg: {
      feature: Feature
      assembly: Assembly
    }) => {
      pos: number
      refName: string
      mateRefName: string
      matePos: number
    }
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
                const { refName, pos, mateRefName, matePos } =
                  viewType.getBreakendCoveringRegions({ feature, assembly })
                let viewInStack = session.views.find(
                  f => f.id === stableViewId,
                ) as { views: LinearGenomeViewModel[] } | undefined

                const displayName = `${
                  feature.get('name') || feature.get('id') || 'breakend'
                } split detail`
                if (!viewInStack) {
                  viewInStack = session.addView('BreakpointSplitView', {
                    id: stableViewId,
                    type: 'BreakpointSplitView',
                    displayName,
                    views: [
                      {
                        type: 'LinearGenomeView',
                        tracks: view?.tracks
                          ? stripIds(getSnapshot(view.tracks))
                          : [],
                      },
                    ],
                  }) as unknown as { views: LinearGenomeViewModel[] }
                }
                // @ts-expect-error
                viewInStack.setDisplayName(displayName)

                await viewInStack.views[0]!.navToLocations(
                  gatherOverlaps(
                    [
                      {
                        refName,
                        start: Math.max(0, pos - w),
                        end: pos + w,
                        assemblyName,
                      },
                      {
                        refName: mateRefName,
                        start: Math.max(0, matePos - w),
                        end: matePos + w,
                        assemblyName,
                      },
                    ],
                    w,
                  ),
                )
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

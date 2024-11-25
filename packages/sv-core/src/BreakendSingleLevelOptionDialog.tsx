import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { getSession, gatherOverlaps, useLocalStorage } from '@jbrowse/core/util'
import { Button, DialogActions, DialogContent, TextField } from '@mui/material'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import Checkbox2 from './Checkbox2'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
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
  model,
  handleClose,
  feature,
  assemblyName,
  viewType,
  view,
}: {
  model: unknown
  handleClose: () => void
  feature: Feature
  view: LinearGenomeViewModel
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
        <Checkbox2
          checked={copyTracks}
          label="Copy tracks into the new view"
          onChange={event => {
            setCopyTracks(event.target.checked)
          }}
        />

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
            const session = getSession(model)
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                const assembly = session.assemblyManager.get(assemblyName)
                const w = +windowSize
                if (Number.isNaN(w)) {
                  throw new Error('windowSize not a number')
                }
                const { refName, pos, mateRefName, matePos } =
                  // @ts-expect-error
                  viewType.getBreakendCoveringRegions({ feature, assembly })

                const breakpointSplitView = session.addView(
                  'BreakpointSplitView',
                  {
                    type: 'BreakpointSplitView',
                    displayName: `${
                      feature.get('name') || feature.get('id') || 'breakend'
                    } split detail`,
                    views: [
                      {
                        type: 'LinearGenomeView',
                        tracks: stripIds(getSnapshot(view.tracks)),
                      },
                    ],
                  },
                ) as unknown as { views: LinearGenomeViewModel[] }

                await breakpointSplitView.views[0]!.navToLocations(
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
                session.notify(`${e}`)
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

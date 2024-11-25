import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { when } from 'mobx'
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

const BreakendMultiLevelOptionDialog = observer(function ({
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
  const [mirror, setMirror] = useState(true)

  return (
    <Dialog
      open
      onClose={handleClose}
      title="Multi-level breakpoint split view options"
    >
      <DialogContent>
        <Checkbox2
          checked={copyTracks}
          label="Copy tracks into the new view"
          onChange={event => {
            setCopyTracks(event.target.checked)
          }}
        />

        {copyTracks ? (
          <Checkbox2
            checked={mirror}
            disabled={!copyTracks}
            label="Mirror the copied tracks (only available if copying tracks and using two level)"
            onChange={event => {
              setMirror(event.target.checked)
            }}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              const session = getSession(model)
              try {
                const asm =
                  await session.assemblyManager.waitForAssembly(assemblyName)
                if (!asm) {
                  throw new Error(`assembly ${assemblyName} not found`)
                }

                const { refName, pos, mateRefName, matePos } =
                  viewType.getBreakendCoveringRegions({
                    feature,
                    assembly: asm,
                  })

                const viewTracks = getSnapshot(view.tracks) as Track[]
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
                        hideHeader: true,
                        tracks: stripIds(getSnapshot(view.tracks)),
                      },
                      {
                        type: 'LinearGenomeView',
                        hideHeader: true,
                        tracks: stripIds(
                          mirror ? [...viewTracks].reverse() : viewTracks,
                        ),
                      },
                    ],
                  },
                ) as unknown as { views: LinearGenomeViewModel[] }
                const r1 = asm.regions!.find(r => r.refName === refName)
                const r2 = asm.regions!.find(r => r.refName === mateRefName)
                if (!r1 || !r2) {
                  throw new Error("can't find regions")
                }
                await Promise.all([
                  breakpointSplitView.views[0]!.navToLocations([
                    {
                      refName,
                      start: r1.start,
                      end: pos,
                      assemblyName,
                    },
                    {
                      refName,
                      start: pos + 1,
                      end: r1.end,
                      assemblyName,
                    },
                  ]),
                  breakpointSplitView.views[1]!.navToLocations([
                    {
                      refName: mateRefName,
                      start: r2.start,
                      end: matePos,
                      assemblyName,
                    },
                    {
                      refName: mateRefName,
                      start: matePos + 1,
                      end: r2.end,
                      assemblyName,
                    },
                  ]),
                ])
                await when(
                  () =>
                    breakpointSplitView.views[1]!.initialized &&
                    breakpointSplitView.views[0]!.initialized,
                )
                breakpointSplitView.views[1]!.zoomTo(10)
                breakpointSplitView.views[0]!.zoomTo(10)
                breakpointSplitView.views[1]!.centerAt(matePos, mateRefName)
                breakpointSplitView.views[0]!.centerAt(pos, refName)
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

export default BreakendMultiLevelOptionDialog

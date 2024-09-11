import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { Button, DialogActions, DialogContent, TextField } from '@mui/material'
import { getSnapshot } from 'mobx-state-tree'
import { Dialog } from '@jbrowse/core/ui'
import { getSession, Feature, useLocalStorage } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'

// locals
import Checkbox2 from './Checkbox2'

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
  const [windowSize, setWindowSize] = useLocalStorage(
    'breakpointWindowSize',
    '5000',
  )

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
            try {
              console.log({ assemblyName })
              const assembly = session.assemblyManager.get(assemblyName)
              const w = +windowSize
              if (Number.isNaN(w)) {
                throw new Error('windowSize not a number')
              }

              const { refName, pos, mateRefName, matePos } =
                // @ts-expect-error
                viewType.getBreakendCoveringRegions({ feature, assembly })

              // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
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
              const w2 = Math.floor(w / 2)
              breakpointSplitView.views[0]!.navToLocations([
                {
                  refName,
                  start: Math.max(0, pos - w2),
                  end: pos,
                  assemblyName,
                },
                {
                  refName,
                  start: Math.max(0, pos + 1),
                  end: pos + w2,
                  assemblyName,
                },
              ])
              breakpointSplitView.views[1]!.navToLocations([
                {
                  refName: mateRefName,
                  start: Math.max(0, matePos - w2),
                  end: matePos,
                  assemblyName,
                },
                {
                  refName: mateRefName,
                  start: Math.max(0, matePos + 1),
                  end: matePos + w2,
                  assemblyName,
                },
              ])
            } catch (e) {
              console.error(e)
              session.notify(`${e}`)
            }
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

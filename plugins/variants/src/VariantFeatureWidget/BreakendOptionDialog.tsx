import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { Button, DialogActions, DialogContent, TextField } from '@mui/material'
import { getSnapshot } from 'mobx-state-tree'
import { Dialog } from '@jbrowse/core/ui'
import {
  getSession,
  Feature,
  gatherOverlaps,
  assembleLocString,
} from '@jbrowse/core/util'
import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import { VariantFeatureWidgetModel } from './stateModelFactory'
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

const BreakendOptionDialog = observer(function ({
  model,
  handleClose,
  feature,
  viewType,
}: {
  model: VariantFeatureWidgetModel
  handleClose: () => void
  feature: Feature
  viewType: ViewType
}) {
  const [copyTracks, setCopyTracks] = useState(true)
  const [mirror, setMirror] = useState(true)
  const [twoLevel, setTwoLevel] = useState(true)
  const [windowSize, setWindowSize] = useState('5000')

  return (
    <Dialog open onClose={handleClose} title="Breakpoint split view options">
      <DialogContent>
        <Checkbox2
          checked={copyTracks}
          label="Copy tracks into the new view"
          onChange={event => {
            setCopyTracks(event.target.checked)
          }}
        />
        <Checkbox2
          checked={twoLevel}
          label="Use two stacked linear genome views?"
          onChange={event => {
            setTwoLevel(event.target.checked)
          }}
        />
        {copyTracks && twoLevel ? (
          <Checkbox2
            checked={mirror}
            disabled={!copyTracks || !twoLevel}
            label="Mirror the copied tracks (only available if copying tracks and using two level)"
            onChange={event => {
              setMirror(event.target.checked)
            }}
          />
        ) : null}
        <TextField
          label="Window size (bp)"
          value={windowSize}
          onChange={event => setWindowSize(event.target.value)}
        />

        {/*<div>
          Navigating to:
          {!Number.isNaN(w)
            ? gatherOverlaps([
                {
                  refName,
                  start: pos - w,
                  end: pos + w,
                  assemblyName,
                },
                {
                  refName: mateRefName,
                  start: matePos - w,
                  end: matePos + w,
                  assemblyName,
                },
              ]).map(f => assembleLocString(f))
            : null}
        </div>*/}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            const { view } = model
            const session = getSession(model)
            try {
              const { assemblyName } = view.displayedRegions[0]!
              console.log({ assemblyName })
              const assembly = session.assemblyManager.get(assemblyName)
              const w = +windowSize
              if (Number.isNaN(w)) {
                throw new Error('windowSize not a number')
              }
              if (!twoLevel) {
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

                breakpointSplitView.views[0]!.navToLocations(
                  gatherOverlaps([
                    {
                      refName,
                      start: pos - w,
                      end: pos + w,
                      assemblyName,
                    },
                    {
                      refName: mateRefName,
                      start: matePos - w,
                      end: matePos + w,
                      assemblyName,
                    },
                  ]),
                )
              } else {
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
                    start: pos - w2,
                    end: pos,
                    assemblyName,
                  },
                  {
                    refName,
                    start: pos + 1,
                    end: pos + w2,
                    assemblyName,
                  },
                ])
                breakpointSplitView.views[1]!.navToLocations([
                  {
                    refName: mateRefName,
                    start: matePos - w2,
                    end: matePos,
                    assemblyName,
                  },
                  {
                    refName: mateRefName,
                    start: matePos + 1,
                    end: matePos + w2,
                    assemblyName,
                  },
                ])
              }
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

export default BreakendOptionDialog

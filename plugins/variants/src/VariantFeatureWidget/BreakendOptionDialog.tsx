import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { getSnapshot } from 'mobx-state-tree'
import { Dialog } from '@jbrowse/core/ui'
import { getSession, Feature, gatherOverlaps } from '@jbrowse/core/util'
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
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            const { view } = model
            const session = getSession(model)
            try {
              if (!twoLevel) {
                const { assemblyName } = view.displayedRegions[0]!
                const assembly = session.assemblyManager.get(assemblyName)
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
                      start: pos - 1000,
                      end: pos + 1000,
                      assemblyName,
                    },
                    {
                      refName: mateRefName,
                      start: pos - 1000,
                      end: pos + 1000,
                      assemblyName,
                    },
                  ]),
                )
              } else {
                // @ts-expect-error
                const viewSnapshot = viewType.snapshotFromBreakendFeature(
                  feature,
                  view,
                )
                const [view1, view2] = viewSnapshot.views
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                const viewTracks = getSnapshot(view.tracks) as Track[]
                session.addView('BreakpointSplitView', {
                  ...viewSnapshot,
                  views: [
                    {
                      ...view1,
                      tracks: stripIds(viewTracks),
                      offsetPx: view1.offsetPx - view.width / 2 + 100,
                    },
                    {
                      ...view2,
                      tracks: stripIds(
                        mirror ? [...viewTracks].reverse() : viewTracks,
                      ),
                      offsetPx: view2.offsetPx - view.width / 2 + 100,
                    },
                  ],
                })
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

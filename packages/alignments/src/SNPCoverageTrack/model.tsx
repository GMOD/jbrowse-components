import { types, getParent } from 'mobx-state-tree'
import wiggleStateModelFactory from '@gmod/jbrowse-plugin-wiggle/src/WiggleTrack/model'
import WiggleTrackComponent from '@gmod/jbrowse-plugin-wiggle/src/WiggleTrack/components/WiggleTrackComponent'
import { LinearGenomeViewModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { getContainingView } from '@gmod/jbrowse-core/util'
import React from 'react'
import Button from '@material-ui/core/Button'
import Typography from '@material-ui/core/Typography'
import Tooltip from './Tooltip'

// using a map because it preserves order
const rendererTypes = new Map([['snpcoverage', 'SNPCoverageRenderer']])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stateModelFactory = (configSchema: any) =>
  types
    .compose(
      'SNPCoverageTrack',
      wiggleStateModelFactory(configSchema),
      types.model({ type: types.literal('SNPCoverageTrack') }),
    )
    .volatile(() => ({
      ReactComponent: (WiggleTrackComponent as unknown) as React.FC,
    }))
    .views(self => ({
      get TooltipComponent() {
        return Tooltip
      },
      get rendererTypeName() {
        return rendererTypes.get('snpcoverage')
      },

      get needsScalebar() {
        return true
      },

      get contextMenuItems() {
        return []
      },
      regionCannotBeRendered() {
        const mainTrack = getParent(self)
        const view = getContainingView(self) as LinearGenomeViewModel
        if (view && view.bpPerPx > mainTrack.maxViewBpPerPx) {
          return (
            <>
              <Typography component="span" variant="body2">
                Zoom in to see features or{' '}
              </Typography>
              <Button
                data-testid="reload_button"
                onClick={() => {
                  mainTrack.setUserBpPerPxLimit(view.bpPerPx)
                  self.reload()
                }}
                size="small"
                variant="outlined"
              >
                Force Load
              </Button>
              <Typography component="span" variant="body2">
                (force load may be slow)
              </Typography>
            </>
          )
        }
        return undefined
      },
    }))

export type SNPCoverageTrackModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory

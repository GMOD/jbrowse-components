import { types, getParent } from 'mobx-state-tree'
import wiggleStateModelFactory from '@gmod/jbrowse-plugin-wiggle/src/WiggleTrack/model'
import WiggleTrackComponent from '@gmod/jbrowse-plugin-wiggle/src/WiggleTrack/components/WiggleTrackComponent'
import { LinearGenomeViewModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { getContainingView } from '@gmod/jbrowse-core/util'
import React from 'react'
import Button from '@material-ui/core/Button'
import RefreshIcon from '@material-ui/icons/Refresh'
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
    .volatile(self => ({
      ReactComponent: (WiggleTrackComponent as unknown) as React.FC,
      defaultZoomLimit: 16,
    }))
    .actions(self => ({
      setDefaultZoomLimit(newLimit: number) {
        self.defaultZoomLimit = newLimit
      },
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
        const warning =
          'Hit max feature limit. Zoom in or reload(reload may fail)'
        if (view && view.bpPerPx > mainTrack.defaultZoomLimit) {
          return (
            <Button
              data-testid="reload_button"
              onClick={() => {
                mainTrack.setDefaultZoomLimit(view.bpPerPx)
                self.reload()
              }}
              size="small"
              startIcon={<RefreshIcon />}
            >
              {warning}
            </Button>
          )
        }
        return undefined
      },
    }))

export type SNPCoverageTrackModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory

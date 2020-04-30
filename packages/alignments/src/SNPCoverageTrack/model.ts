import { types } from 'mobx-state-tree'
import wiggleStateModelFactory from '@gmod/jbrowse-plugin-wiggle/src/WiggleTrack/model'
// import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'

// using a map because it preserves order
const rendererTypes = new Map([['snpcoverage', 'SNPCoverageRenderer']])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stateModelFactory = (configSchema: any) =>
  types.compose(
    'SNPCoverageTrack',
    wiggleStateModelFactory(configSchema),
    types.model({ type: types.literal('SNPCoverageTrack') }).views(self => ({
      get rendererTypeName() {
        return rendererTypes.get('snpcoverage')
      },

      get needsScalebar() {
        return true
      },
      // get contextMenu() {
      //   return getParentRenderProps(self).trackModel.menuOptions
      // },
    })),
  )

export type SNPCoverageTrackModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory

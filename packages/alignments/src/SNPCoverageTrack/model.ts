import { getConf } from '@gmod/jbrowse-core/configuration'
import { types } from 'mobx-state-tree'
import wiggleStateModelFactory from '@gmod/jbrowse-plugin-wiggle/src/WiggleTrack/model'

// using a map because it preserves order
const rendererTypes = new Map([['snpcoverage', 'SNPCoverageRenderer']])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stateModelFactory = (configSchema: any) =>
  types.compose(
    'SNPCoverageTrack',
    wiggleStateModelFactory(configSchema),
    types.model({ type: types.literal('SNPCoverageTrack') }).views(self => ({
      get rendererTypeName() {
        const viewName = getConf(self, 'defaultRendering')
        const rendererType = rendererTypes.get(viewName)
        if (!rendererType)
          throw new Error(`unknown wiggle renderer type ${viewName}`)
        return rendererType
      },

      get needsScalebar() {
        return true
      },
    })),
  )

export type SNPCoverageTrackModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory

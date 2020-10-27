import { types } from 'mobx-state-tree'
import { wiggleTrackModelFactory } from '@jbrowse/plugin-wiggle'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import Tooltip from './Tooltip'

// using a map because it preserves order
const rendererTypes = new Map([['snpcoverage', 'SNPCoverageRenderer']])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stateModelFactory = (configSchema: any) =>
  types
    .compose(
      'SNPCoverageTrack',
      wiggleTrackModelFactory(configSchema),
      types.model({ type: types.literal('SNPCoverageTrack') }),
    )
    .actions(self => ({
      setConfig(configuration: AnyConfigurationModel) {
        self.configuration = configuration
      },
    }))
    .views(() => ({
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
    }))

export type SNPCoverageTrackModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory

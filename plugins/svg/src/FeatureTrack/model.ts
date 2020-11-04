import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { MenuItem } from '@jbrowse/core/ui'
import VisibilityIcon from '@material-ui/icons/Visibility'
// import {
//   isAbortException,
//   getSession,
//   getContainingView,
// } from '@jbrowse/core/util'
// import {
//   getParentRenderProps,
//   getRpcSessionId,
//   getTrackAssemblyNames,
// } from '@jbrowse/core/util/tracks'
import { blockBasedTrackModel } from '@jbrowse/plugin-linear-genome-view'
// import { autorun, observable } from 'mobx'
import {
  addDisposer,
  getSnapshot,
  isAlive,
  types,
  Instance,
} from 'mobx-state-tree'

// import { getNiceDomain } from '../util'

// import FeatureTrackComponent from './components/FeatureTrackComponent'
// import Tooltip from './components/Tooltip'
// import { FeatureStats } from '../statsUtil'

// using a map because it preserves order
// const rendererTypes = new Map([
//   ['xyplot', 'XYPlotRenderer'],
//   ['density', 'DensityRenderer'],
//   ['line', 'LinePlotRenderer'],
// ])

// function logb(x: number, y: number) {
//   return Math.log(y) / Math.log(x)
// }
// function round(v: number, b = 1.5) {
//   return (v >= 0 ? 1 : -1) * Math.pow(b, 1 + Math.floor(logb(b, Math.abs(v))))
// }

const stateModelFactory = (configSchema: unknown) =>
  types
    .compose(
      'FeaturesTrack',
      blockBasedTrackModel,
      types
        .model({
          type: types.literal('FeaturesTrack'),
          showLabels: types.maybe(types.boolean, true),
          displayMode: types.maybe(types.string, 'normal'),
          configuration: ConfigurationReference(configSchema),
        })
        .volatile(() => ({
          // avoid circular reference since FeatureTrackComponent receives this model
        })),
    )
    .actions(self => ({
      setShowLabels(val: boolean) {
        self.showLabels = val
      },
      setDisplayMode(val: string) {
        self.displayMode = val
      },
    }))
    .views(self => {
      const { trackMenuItems } = self
      return {
        get trackMenuItems(): MenuItem[] {
          const displayModes = [
            'compact',
            'reducedRepresentation',
            'normal',
            'collapse',
          ]
          return [
            ...trackMenuItems,
            {
              label: 'Show labels',
              icon: VisibilityIcon,
              type: 'checkbox',
              onClick: val => {
                self.setShowLabels(val)
              },
            },
            // {
            //   label: 'Display mode',
            //   icon: VisibilityIcon,
            //   type: 'checkbox',
            //   subMenu: [
            //     {
            //       'label': 'Compact',
            //       onClick: () => {
            //         self.setDisplayMode
            //       }

            //     },

            //   ]
            //   onClick: self.toggleCoverage,
            //   checked: self.showCoverage,
            // },
          ]
        },
      }
    })

export type FeatureTrackStateModel = ReturnType<typeof stateModelFactory>
export type FeatureTrackModel = Instance<FeatureTrackStateModel>

export default stateModelFactory

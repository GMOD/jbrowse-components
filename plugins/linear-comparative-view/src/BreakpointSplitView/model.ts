import { types, Instance } from 'mobx-state-tree'
import baseModel from '../LinearComparativeView/model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function stateModelFactory(pluginManager: any) {
  return types.compose(
    baseModel(pluginManager),
    types.model('BreakpointSplitView', {
      type: types.literal('BreakpointSplitView'),
    }),
  )
}
export type BreakpointSplitView = ReturnType<typeof stateModelFactory>
export type BreakpointSplitViewModel = Instance<BreakpointSplitView>

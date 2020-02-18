import { types, Instance } from 'mobx-state-tree'
import baseModel from '../LinearComparativeView/model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function stateModelFactory(pluginManager: any) {
  return types.compose(
    baseModel(pluginManager),
    types.model('LinearSyntenyView', {
      type: types.literal('LinearSyntenyView'),
    }),
  )
}
export type LinearSyntenyView = ReturnType<typeof stateModelFactory>
export type LinearSyntenyViewModel = Instance<LinearSyntenyView>

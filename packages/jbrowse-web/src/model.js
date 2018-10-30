import { types } from 'mobx-state-tree'
import LinearGenomeViewState from './ui/LinearGenomeView/model'

export const RootStore = types
  .model({
    views: types.array(LinearGenomeViewState),
  })
  .actions(self => ({
    addView(type) {
      if (type === 'linear') {
        self.views.push(LinearGenomeViewState.create({ type: 'linear' }))
      }
    },
  }))

export default RootStore

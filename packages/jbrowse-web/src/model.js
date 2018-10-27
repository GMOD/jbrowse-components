import { types } from 'mobx-state-tree'
import LinearGenomeViewState from './ui/LinearGenomeView/model'

let viewSerial = 1
export const RootStore = types
  .model({
    views: types.array(LinearGenomeViewState),
  })
  .actions(self => {
    return {
      addView(type) {
        if (type === 'linear') {
          self.views.push(LinearGenomeViewState.create({ id: viewSerial++ }))
        }
      },
    }
  })

export default RootStore.create({})

import { types } from 'mobx-state-tree'

const stateModel = types
  .model({ type: types.literal('HelloView') })
  .actions(() => ({
    // unused but required by your view
    setWidth() {},
  }))

export default stateModel

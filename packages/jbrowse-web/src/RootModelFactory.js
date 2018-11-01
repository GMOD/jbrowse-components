import { types } from 'mobx-state-tree'

export default function({ viewTypes }) {
  const RootModel = types
    .model('JBrowseWebRootModel', {
      views: types.array(
        types.union(
          ...Object.values(viewTypes).map(({ mstModel }) => mstModel),
        ),
      ),
    })
    .actions(self => ({
      addView(typeName, inputData = {}) {
        const typeDefinition = viewTypes[typeName]
        if (!typeDefinition) throw new Error(`unknown view type ${typeName}`)
        const data = Object.assign({}, inputData, { type: typeName })
        self.views.push(typeDefinition.mstModel.create(data))
      },
    }))
  return RootModel
}

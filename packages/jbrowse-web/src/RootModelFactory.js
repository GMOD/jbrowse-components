import { types } from 'mobx-state-tree'

export default function({ viewTypes, uiTypes }) {
  const RootModel = types
    .model('JBrowseWebRootModel', {
      views: types.array(
        types.union(
          ...Object.values(viewTypes).map(({ mstModel }) => mstModel),
        ),
      ),
      uis: types.array(
        types.union(...Object.values(uiTypes).map(({ mstModel }) => mstModel)),
      ),
    })
    .actions(self => ({
      addView(typeName, inputData = {}) {
        const typeDefinition = viewTypes[typeName]
        if (!typeDefinition) throw new Error(`unknown view type ${typeName}`)
        const data = Object.assign({}, inputData, { type: typeName })
        self.views.push(typeDefinition.mstModel.create(data))
      },
      addUi(typeName, inputData = {}) {
        const typeDefinition = uiTypes[typeName]
        if (!typeDefinition) throw new Error(`unknown UI type ${typeName}`)
        const data = Object.assign({}, inputData, { type: typeName })
        self.uis.push(typeDefinition.mstModel.create(data))
      },
    }))
  return RootModel
}

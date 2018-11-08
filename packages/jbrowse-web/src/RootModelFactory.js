import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from './configuration'

const isPresent = thing => !!thing

function extractAll(fieldName, typesObject) {
  return Object.values(typesObject)
    .map(definition => definition[fieldName])
    .filter(isPresent)
}

export default function({ viewTypes, trackTypes }) {
  if (!trackTypes) {
    console.warn(
      'No track types registered, will not be able to display any tracks.',
    )
    trackTypes = {}
  }

  const RootModel = types
    .model('JBrowseWebRootModel', {
      browser: types.frozen(this),
      views: types.array(types.union(...extractAll('stateModel', viewTypes))),
      tracks: types.array(types.union(...extractAll('stateModel', trackTypes))),
      configuration: ConfigurationSchema('JBrowseWebRoot', {
        tracks: types.array(
          types.union(...extractAll('configSchema', trackTypes)),
        ),
      }),
    })
    .actions(self => ({
      addView(typeName, initialState = {}, configuration = {}) {
        const typeDefinition = viewTypes[typeName]
        if (!typeDefinition) throw new Error(`unknown view type ${typeName}`)
        const data = Object.assign({}, initialState, {
          type: typeName,
          configuration,
        })
        self.views.push(typeDefinition.stateModel.create(data))
      },
    }))
  return RootModel
}

// a track is a combination of a dataset and a renderer, along with some conditions
// specifying in which contexts it is available (which assemblies, which views, etc)

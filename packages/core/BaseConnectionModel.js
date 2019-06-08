import { types } from 'mobx-state-tree'

export default pluginManager => {
  return types
    .model('Connection', {
      assemblies: types.map(
        types
          .model('Assembly', {
            assemblyName: types.identifier,
            tracks: types.array(
              pluginManager.pluggableConfigSchemaType('track'),
            ),
            sequence:
              pluginManager.elementTypes.track.ReferenceSequence.configSchema,
            defaultSequence: false,
          })
          .actions(self => ({
            addTrackConf(typeName, data) {
              const type = pluginManager.getTrackType(typeName)
              if (!type) throw new Error(`unknown track type ${typeName}`)
              const schemaType = type.configSchema
              const conf = schemaType.create(
                Object.assign({ type: typeName }, data),
              )
              self.tracks.push(conf)
              return conf
            },
            setSequence(sequenceConf) {
              self.sequence = sequenceConf
            },
            setDefaultSequence(isDefault) {
              self.defaultSequence = isDefault
            },
          })),
      ),
    })
    .actions(self => ({
      clear() {
        self.assemblies.clear()
      },

      addAssembly(assemblySnapshot) {
        self.assemblies.set(assemblySnapshot.assemblyName, assemblySnapshot)
      },

      addEmptyAssembly(assemblyName) {
        self.assemblies.set(assemblyName, { assemblyName })
      },

      // connect: flow(function* connect(connectionConf) {
      //   // Add assemblies and tracks here
      // }),
    }))
}

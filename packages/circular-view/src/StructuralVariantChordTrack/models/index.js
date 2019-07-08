export default pluginManager => {
  const { jbrequire } = pluginManager
  const { autorun } = jbrequire('mobx')
  const { types, addDisposer, getSnapshot } = jbrequire('mobx-state-tree')
  const { ConfigurationSchema, ConfigurationReference } = jbrequire(
    '@gmod/jbrowse-core/configuration',
  )

  const { getContainingView } = jbrequire('@gmod/jbrowse-core/util/tracks')

  const BlockState = jbrequire(require('./BlockState'))

  const {
    configSchema: ChordTrackConfigSchema,
    stateModel: ChordTrackStateModel,
  } = jbrequire(require('../../ChordTrack/models/ChordTrack'))

  const configSchema = ConfigurationSchema(
    'StructuralVariantChordTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    { baseConfiguration: ChordTrackConfigSchema, explicitlyTyped: true },
  )

  const stateModel = types
    .compose(
      'StructuralVariantChordTrack',
      ChordTrackStateModel,
      types.model({
        type: types.literal('StructuralVariantChordTrack'),
        configuration: ConfigurationReference(configSchema),

        blockState: types.map(BlockState),
      }),
    )
    .views(self => ({
      get blockDefinitions() {
        return getContainingView(self).staticSlices
      },
    }))
    .actions(self => ({
      afterAttach() {
        // watch the parent's blocks to update our block state when they change
        const blockWatchDisposer = autorun(() => {
          // create any blocks that we need to create
          const blocksPresent = {}
          self.blockDefinitions.forEach(block => {
            blocksPresent[block.key] = true
            if (!self.blockState.has(block.key)) {
              self.addBlock(block.key, block)
            }
          })
          // delete any blocks we need to delete
          self.blockState.forEach((value, key) => {
            if (!blocksPresent[key]) self.deleteBlock(key)
          })
        })

        addDisposer(self, blockWatchDisposer)
      },

      addBlock(key, block) {
        self.blockState.set(
          key,
          BlockState.create({
            key,
            block,
          }),
        )
      },

      deleteBlock(key) {
        self.blockState.delete(key)
      },
    }))

  return { stateModel, configSchema }
}

// http://localhost:3000/test_data/hs37d5.HG002-SequelII-CCS.sv.vcf.gz.tbi

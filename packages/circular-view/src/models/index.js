export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types } = jbrequire('mobx-state-tree')
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')
  const { ConfigurationSchema } = jbrequire('@gmod/jbrowse-core/configuration')

  const configSchema = ConfigurationSchema(
    'CircularView',
    {},
    { explicitlyTyped: true },
  )

  const stateModel = types
    .model('CircularView', {
      id: ElementId,
      type: types.literal('CircularView'),
      offsetPx: 0,
      bpPerPx: 1,
      rotation: 0, // rotation is radians
      tracks: types.array(
        pluginManager.pluggableMstType('track', 'stateModel'),
      ),
      width: 800,
      height: 400,
      configuration: configSchema,
      minimumBlockWidth: 20,
    })
    .views(self => ({
      get figureDimensions() {
        return [3000, 3000]
      },
      get figureWidth() {
        return self.figureDimensions[0]
      },
      get figureHeight() {
        return self.figureDimensions[1]
      },
    }))
    .actions(self => ({
      setWidth(newWidth) {
        self.width = newWidth
      },
      resizeHeight(myId, distance) {
        self.height += distance
      },

      rotateClockwiseButton() {
        self.rotateClockwise()
      },

      rotateCounterClockwiseButton() {
        self.rotateCounterClockwise()
      },

      rotateClockwise(distance = 0.17) {
        self.rotation += distance
      },

      rotateCounterClockwise(distance = 0.17) {
        self.rotation -= distance
      },
    }))

  return { stateModel, configSchema }
}

function calculateStaticBlocks(self) {
  const blocks = []
  const marginPx = 5
  for (const region of self.displayedRegions) {
    blocks.push(region)
    blocks.push({
      type: 'margin',
      widthBp: marginPx * self.bpPerPx,
      widthPx: marginPx,
    })
  }
  return blocks
}

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getParent, getRoot } = jbrequire('mobx-state-tree')
  const { ElementId, Region } = jbrequire('@gmod/jbrowse-core/mst-types')
  // const { degToRad } = jbrequire('@gmod/jbrowse-core/util')
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
      offsetRadians: 0,
      bpPerPx: 1,
      tracks: types.array(
        pluginManager.pluggableMstType('track', 'stateModel'),
      ),
      width: 800,
      height: 400,
      configuration: configSchema,
      minimumBlockWidth: 20,
      displayedRegions: types.array(Region),
      displayRegionsFromAssemblyName: types.maybe(types.string),
    })
    .views(self => ({
      get staticBlocks() {
        return calculateStaticBlocks(self)
      },
      get radiusPx() {
        const numRegions = self.displayedRegions.length
        const paddingPx = 5
        const circumferencePx =
          paddingPx * numRegions + self.totalBp / self.bpPerPx
        return circumferencePx / 2 / Math.PI
      },
      get totalBp() {
        let total = 0
        for (const region of self.displayedRegions) {
          total += region.end - region.start
        }
        return total
      },
      get figureDimensions() {
        // return [3000, 3000]
        return [self.radiusPx, self.radiusPx]
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
        self.offsetRadians += distance
      },

      rotateCounterClockwise(distance = 0.17) {
        self.offsetRadians -= distance
      },

      closeView() {
        getParent(self, 2).removeView(self)
      },

      setDisplayedRegions(regions, isFromAssemblyName = false) {
        self.displayedRegions = regions
        if (!isFromAssemblyName)
          this.setDisplayedRegionsFromAssemblyName(undefined)
      },

      setDisplayedRegionsFromAssemblyName(assemblyName) {
        self.displayRegionsFromAssemblyName = assemblyName
        const root = getRoot(self)
        if (root.updateAssemblies) root.updateAssemblies()
      },
    }))

  return { stateModel, configSchema }
}

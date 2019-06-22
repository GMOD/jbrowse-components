export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getParent, getRoot } = jbrequire('mobx-state-tree')
  const { ElementId, Region } = jbrequire('@gmod/jbrowse-core/mst-types')
  const { ConfigurationSchema } = jbrequire('@gmod/jbrowse-core/configuration')
  const calculateStaticSlices = jbrequire(require('./calculateStaticSlices'))

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
      bpPerPx: 50,
      tracks: types.array(
        pluginManager.pluggableMstType('track', 'stateModel'),
      ),
      width: 800,
      height: 400,
      configuration: configSchema,
      spacingPx: 10,
      paddingPx: 20,
      minVisibleWidth: 6,
      minimumBlockWidth: 20,
      displayedRegions: types.array(Region),
      displayRegionsFromAssemblyName: types.maybe(types.string),
    })
    .views(self => ({
      get staticSlices() {
        return calculateStaticSlices(self)
      },
      get circumferencePx() {
        return (
          self.totalBp / self.bpPerPx +
          self.spacingPx * self.visibleRegions.length
        )
      },
      get radiusPx() {
        return self.circumferencePx / (2 * Math.PI)
      },
      get bpPerRadian() {
        // return self.bpPerPx * self.radiusPx
        return (
          (self.totalBp +
            self.visibleRegions.length * self.spacingPx * self.bpPerPx) /
          (2 * Math.PI)
        )
      },
      get pxPerRadian() {
        return self.radiusPx
      },
      get centerXY() {
        return [self.radiusPx + self.paddingPx, self.radiusPx + self.paddingPx]
      },
      get totalBp() {
        let total = 0
        for (const region of self.visibleRegions) {
          if (region.widthBp) {
            total += region.widthBp
          } else {
            total += region.end - region.start
          }
        }
        return total
      },
      get figureDimensions() {
        // return [3000, 3000]
        return [
          self.radiusPx * 2 + 2 * self.paddingPx,
          self.radiusPx * 2 + 2 * self.paddingPx,
        ]
      },
      get figureWidth() {
        return self.figureDimensions[0]
      },
      get figureHeight() {
        return self.figureDimensions[1]
      },
      // this is displayedRegions, post-processed to
      // elide regions that are too small to see reasonably
      get visibleRegions() {
        const visible = []
        self.displayedRegions.forEach(region => {
          const widthBp = region.end - region.start
          const widthPx = widthBp / self.bpPerPx
          if (widthPx > self.minVisibleWidth) {
            visible.push({ ...region, widthBp })
          } else {
            // too small to see, collapse into a single elision region
            const lastVisible = visible[visible.length - 1]
            if (lastVisible.elided) {
              lastVisible.regions.push({ ...region })
              lastVisible.widthBp += widthBp
            } else {
              visible.push({
                elided: true,
                widthBp,
                regions: [{ ...region }],
              })
            }
          }
        })
        return visible
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

      zoomInButton() {
        self.bpPerPx /= 1.4
      },

      zoomOutButton() {
        self.bpPerPx *= 1.4
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

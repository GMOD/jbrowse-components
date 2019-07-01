export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getParent, getRoot } = jbrequire('mobx-state-tree')
  const { ElementId, Region } = jbrequire('@gmod/jbrowse-core/mst-types')
  const { ConfigurationSchema } = jbrequire('@gmod/jbrowse-core/configuration')
  const calculateStaticSlices = jbrequire(require('./calculateStaticSlices'))
  const { clamp } = jbrequire('@gmod/jbrowse-core/util')
  const configSchema = ConfigurationSchema(
    'CircularView',
    {},
    { explicitlyTyped: true },
  )

  const stateModel = types
    .model('CircularView', {
      id: ElementId,
      type: types.literal('CircularView'),
      offsetRadians: -Math.PI / 2,
      bpPerPx: 2000000,
      tracks: types.array(
        pluginManager.pluggableMstType('track', 'stateModel'),
      ),
      width: 800,
      height: 400,
      minimumRadiusPx: 25,
      configuration: configSchema,
      spacingPx: 10,
      paddingPx: 80,
      minBpPerPx: 0.01,
      minVisibleWidth: 6,
      minimumBlockWidth: 20,
      displayedRegions: types.array(Region),
      displayRegionsFromAssemblyName: types.maybe(types.string),
      scrollX: 0,
      scrollY: 0,
      trackSelectorType: 'hierarchical',
    })
    .views(self => ({
      get staticSlices() {
        return calculateStaticSlices(self)
      },
      get circumferencePx() {
        let elidedBp = 0
        for (const r of self.elidedRegions) {
          elidedBp += r.widthBp
        }
        return (
          elidedBp / self.bpPerPx + self.spacingPx * self.elidedRegions.length
        )
      },
      get radiusPx() {
        return self.circumferencePx / (2 * Math.PI)
      },
      get bpPerRadian() {
        return self.bpPerPx * self.radiusPx
      },
      get pxPerRadian() {
        return self.radiusPx
      },
      get centerXY() {
        return [self.radiusPx + self.paddingPx, self.radiusPx + self.paddingPx]
      },
      get totalBp() {
        let total = 0
        for (const region of self.displayedRegions) {
          total += region.end - region.start
        }
        return total
      },
      get maxBpPerPx() {
        const minCircumferencePx = 2 * Math.PI * self.minimumRadiusPx
        return self.totalBp / minCircumferencePx
      },
      get figureDimensions() {
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
      get elidedRegions() {
        const visible = []
        self.displayedRegions.forEach(region => {
          const widthBp = region.end - region.start
          const widthPx = widthBp / self.bpPerPx
          if (widthPx < self.minVisibleWidth) {
            // too small to see, collapse into a single elision region
            const lastVisible = visible[visible.length - 1]
            if (lastVisible && lastVisible.elided) {
              lastVisible.regions.push({ ...region })
              lastVisible.widthBp += widthBp
            } else {
              visible.push({
                elided: true,
                widthBp,
                regions: [{ ...region }],
              })
            }
          } else {
            // big enough to see, display it
            visible.push({ ...region, widthBp })
          }
        })

        // remove any single-region elisions
        for (let i = 0; i < visible.length; i += 1) {
          const v = visible[i]
          if (v.elided && v.regions.length == 1) {
            delete v.elided
            visible[i] = { ...v, ...v.regions[0] }
          }
        }
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
        self.setBpPerPx(self.bpPerPx / 1.4)
      },

      zoomOutButton() {
        self.setBpPerPx(self.bpPerPx * 1.4)
      },

      setBpPerPx(newVal) {
        self.bpPerPx = clamp(newVal, self.minBpPerPx, self.maxBpPerPx)
      },

      onScroll(event) {
        self.scrollX = event.currentTarget.scrollLeft
        self.scrollY = event.currentTarget.scrollTop
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

      activateConfigurationUI() {
        getRoot(self).editConfiguration(self.configuration)
      },

      activateTrackSelector() {
        if (self.trackSelectorType === 'hierarchical') {
          const rootModel = getRoot(self)
          if (!rootModel.drawerWidgets.get('hierarchicalTrackSelector'))
            rootModel.addDrawerWidget(
              'HierarchicalTrackSelectorDrawerWidget',
              'hierarchicalTrackSelector',
              { view: self },
            )
          const selector = rootModel.drawerWidgets.get(
            'hierarchicalTrackSelector',
          )
          selector.setView(self)
          rootModel.showDrawerWidget(selector)
        } else {
          throw new Error(
            `invalid track selector type ${self.trackSelectorType}`,
          )
        }
      },
    }))

  return { stateModel, configSchema }
}

/*
PLANS

- slice visibility computation
- tracks
- ruler tick marks
- set viewport scroll from state snapshot

*/

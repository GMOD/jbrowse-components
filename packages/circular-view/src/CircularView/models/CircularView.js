import { viewportVisibleSection } from './viewportVisibleRegion'

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { transaction } = jbrequire('mobx')
  const { types, getParent } = jbrequire('mobx-state-tree')
  const { Region } = jbrequire('@gmod/jbrowse-core/util/types/mst')
  const { readConfObject } = jbrequire('@gmod/jbrowse-core/configuration')
  const { clamp, getSession } = jbrequire('@gmod/jbrowse-core/util')
  const BaseViewModel = jbrequire('@gmod/jbrowse-core/BaseViewModel')

  const { calculateStaticSlices, sliceIsVisible } = jbrequire(
    require('./slices'),
  )

  const minHeight = 40
  const minWidth = 100
  const defaultHeight = 400
  const model = types
    .model('CircularView', {
      type: types.literal('CircularView'),
      offsetRadians: -Math.PI / 2,
      bpPerPx: 2000000,
      tracks: types.array(
        pluginManager.pluggableMstType('track', 'stateModel'),
      ),

      hideVerticalResizeHandle: false,
      hideTrackSelectorButton: false,
      lockedFitToWindow: true,
      disableImportForm: false,

      height: types.optional(
        types.refinement('trackHeight', types.number, n => n >= minHeight),
        defaultHeight,
      ),
      minimumRadiusPx: 25,
      spacingPx: 10,
      paddingPx: 80,
      lockedPaddingPx: 100,
      minVisibleWidth: 6,
      minimumBlockWidth: 20,
      displayedRegions: types.array(Region),
      scrollX: 0,
      scrollY: 0,
      trackSelectorType: 'hierarchical',
    })
    .volatile(() => ({
      width: 800,
    }))
    .views(self => ({
      get staticSlices() {
        return calculateStaticSlices(self)
      },
      get visibleStaticSlices() {
        return self.staticSlices.filter(sliceIsVisible.bind(this, self))
      },
      get visibleSection() {
        return viewportVisibleSection(
          [
            self.scrollX,
            self.scrollX + self.width,
            self.scrollY,
            self.scrollY + self.height,
          ],
          self.centerXY,
          self.radiusPx,
        )
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
      get maximumRadiusPx() {
        return self.lockedFitToWindow
          ? Math.min(self.width, self.height) / 2 - self.lockedPaddingPx
          : 1000000
      },
      get maxBpPerPx() {
        const minCircumferencePx = 2 * Math.PI * self.minimumRadiusPx
        return self.totalBp / minCircumferencePx
      },
      get minBpPerPx() {
        // min depends on window dimensions, clamp between old min(0.01) and max
        const maxCircumferencePx = 2 * Math.PI * self.maximumRadiusPx
        return clamp(
          self.totalBp / maxCircumferencePx,
          0.0000000001,
          self.maxBpPerPx,
        )
      },
      get atMaxBpPerPx() {
        return self.bpPerPx >= self.maxBpPerPx
      },
      get atMinBpPerPx() {
        return self.bpPerPx <= self.minBpPerPx
      },
      get tooSmallToLock() {
        return self.minBpPerPx <= 0.0000000001
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
          if (v.elided && v.regions.length === 1) {
            delete v.elided
            visible[i] = { ...v, ...v.regions[0] }
          }
        }
        return visible
      },

      get assemblyNames() {
        const assemblyNames = []
        self.displayedRegions.forEach(displayedRegion => {
          if (!assemblyNames.includes(displayedRegion.assemblyName))
            assemblyNames.push(displayedRegion.assemblyName)
        })
        return assemblyNames
      },
    }))
    .volatile(() => ({
      error: undefined,
    }))
    .actions(self => ({
      // toggle action with a flag stating which mode it's in
      setWidth(newWidth) {
        self.width = Math.max(newWidth, minWidth)
        return self.width
      },
      setHeight(newHeight) {
        self.height = Math.max(newHeight, minHeight)
        return self.height
      },
      resizeHeight(distance) {
        const oldHeight = self.height
        const newHeight = self.setHeight(self.height + distance)
        self.setModelViewWhenAdjust(!self.tooSmallToLock)
        return newHeight - oldHeight
      },
      resizeWidth(distance) {
        const oldWidth = self.width
        const newWidth = self.setWidth(self.width + distance)
        self.setModelViewWhenAdjust(!self.tooSmallToLock)
        return newWidth - oldWidth
      },
      rotateClockwiseButton() {
        self.rotateClockwise(Math.PI / 6)
      },

      rotateCounterClockwiseButton() {
        self.rotateCounterClockwise(Math.PI / 6)
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

      setModelViewWhenAdjust(secondCondition) {
        if (self.lockedFitToWindow && secondCondition) {
          self.setBpPerPx(self.minBpPerPx)
        }
      },

      closeView() {
        getParent(self, 2).removeView(self)
      },

      setDisplayedRegions(regions) {
        const previouslyEmpty = self.displayedRegions.length === 0
        self.displayedRegions = regions

        if (previouslyEmpty) self.setBpPerPx(self.minBpPerPx)
        else self.setBpPerPx(self.bpPerPx)
      },

      activateTrackSelector() {
        if (self.trackSelectorType === 'hierarchical') {
          const session = getSession(self)
          const selector = session.addWidget(
            'HierarchicalTrackSelectorWidget',
            'hierarchicalTrackSelector',
            { view: self },
          )
          session.showWidget(selector)
          return selector
        }
        throw new Error(`invalid track selector type ${self.trackSelectorType}`)
      },

      toggleTrack(configuration) {
        // if we have any tracks with that configuration, turn them off
        const hiddenCount = self.hideTrack(configuration)
        // if none had that configuration, turn one on
        if (!hiddenCount) self.showTrack(configuration)
      },

      setError(error) {
        self.error = error
      },

      showTrack(configuration, initialSnapshot = {}) {
        const { type } = configuration
        if (!type) throw new Error('track configuration has no `type` listed')
        const name = readConfObject(configuration, 'name')
        const trackType = pluginManager.getTrackType(type)
        if (!trackType) throw new Error(`unknown track type ${type}`)
        const track = trackType.stateModel.create({
          ...initialSnapshot,
          name,
          type,
          configuration,
        })
        self.tracks.push(track)
      },

      hideTrack(configuration) {
        // if we have any tracks with that configuration, turn them off
        const shownTracks = self.tracks.filter(
          t => t.configuration === configuration,
        )
        transaction(() => shownTracks.forEach(t => self.tracks.remove(t)))
        return shownTracks.length
      },

      toggleFitToWindowLock() {
        self.lockedFitToWindow = !self.lockedFitToWindow
        // when going unlocked -> locked and circle is cut off, set to the locked minBpPerPx
        self.setModelViewWhenAdjust(self.atMinBpPerPx)
        return self.lockedFitToWindow
      },
    }))

  const stateModel = types.compose(BaseViewModel, model)

  return { stateModel }
}

/*
PLANS

- tracks
- ruler tick marks
- set viewport scroll from state snapshot

*/

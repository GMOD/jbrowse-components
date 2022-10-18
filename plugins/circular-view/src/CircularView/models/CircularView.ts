import PluginManager from '@jbrowse/core/PluginManager'
import {
  cast,
  getParent,
  getRoot,
  resolveIdentifier,
  types,
  SnapshotOrInstance,
  Instance,
} from 'mobx-state-tree'
import { Region } from '@jbrowse/core/util/types/mst'
import { transaction } from 'mobx'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'

import {
  getSession,
  clamp,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { calculateStaticSlices, sliceIsVisible } from './slices'

import { viewportVisibleSection } from './viewportVisibleRegion'

/**
 * !stateModel CircularView
 * extends `BaseViewModel`
 */
function stateModelFactory(pluginManager: PluginManager) {
  const minHeight = 40
  const minWidth = 100
  const defaultHeight = 400
  return types.compose(
    BaseViewModel,
    types
      .model('CircularView', {
        /**
         * !property
         */
        type: types.literal('CircularView'),
        /**
         * !property
         * similar to offsetPx in linear genome view
         */
        offsetRadians: -Math.PI / 2,
        /**
         * !property
         */
        bpPerPx: 2000000,
        /**
         * !property
         */
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        ),

        /**
         * !property
         */
        hideVerticalResizeHandle: false,
        /**
         * !property
         */
        hideTrackSelectorButton: false,
        /**
         * !property
         */
        lockedFitToWindow: true,
        /**
         * !property
         */
        disableImportForm: false,

        /**
         * !property
         */
        height: types.optional(
          types.refinement('trackHeight', types.number, n => n >= minHeight),
          defaultHeight,
        ),
        /**
         * !property
         */
        displayedRegions: types.array(Region),
        /**
         * !property
         */
        scrollX: 0,
        /**
         * !property
         */
        scrollY: 0,

        minimumRadiusPx: 25,
        spacingPx: 10,
        paddingPx: 80,
        lockedPaddingPx: 100,
        minVisibleWidth: 6,
        minimumBlockWidth: 20,

        trackSelectorType: 'hierarchical',
      })
      .volatile(() => ({
        width: 0,
      }))
      .views(self => ({
        /**
         * !getter
         */
        get staticSlices() {
          return calculateStaticSlices(self)
        },

        /**
         * !getter
         */
        get visibleSection() {
          return viewportVisibleSection(
            [
              self.scrollX,
              self.scrollX + self.width,
              self.scrollY,
              self.scrollY + self.height,
            ],
            this.centerXY,
            this.radiusPx,
          )
        },
        /**
         * !getter
         */
        get circumferencePx() {
          let elidedBp = 0
          for (const r of this.elidedRegions) {
            elidedBp += r.widthBp
          }
          return (
            elidedBp / self.bpPerPx + self.spacingPx * this.elidedRegions.length
          )
        },
        /**
         * !getter
         */
        get radiusPx() {
          return this.circumferencePx / (2 * Math.PI)
        },
        /**
         * !getter
         */
        get bpPerRadian() {
          return self.bpPerPx * this.radiusPx
        },
        /**
         * !getter
         */
        get pxPerRadian() {
          return this.radiusPx
        },
        /**
         * !getter
         */
        get centerXY(): [number, number] {
          return [
            this.radiusPx + self.paddingPx,
            this.radiusPx + self.paddingPx,
          ]
        },
        /**
         * !getter
         */
        get totalBp() {
          let total = 0
          for (const region of self.displayedRegions) {
            total += region.end - region.start
          }
          return total
        },
        /**
         * !getter
         */
        get maximumRadiusPx() {
          return self.lockedFitToWindow
            ? Math.min(self.width, self.height) / 2 - self.lockedPaddingPx
            : 1000000
        },
        /**
         * !getter
         */
        get maxBpPerPx() {
          const minCircumferencePx = 2 * Math.PI * self.minimumRadiusPx
          return this.totalBp / minCircumferencePx
        },
        /**
         * !getter
         */
        get minBpPerPx() {
          // min depends on window dimensions, clamp between old min(0.01) and max
          const maxCircumferencePx = 2 * Math.PI * this.maximumRadiusPx
          return clamp(
            this.totalBp / maxCircumferencePx,
            0.0000000001,
            this.maxBpPerPx,
          )
        },
        /**
         * !getter
         */
        get atMaxBpPerPx() {
          return self.bpPerPx >= this.maxBpPerPx
        },
        /**
         * !getter
         */
        get atMinBpPerPx() {
          return self.bpPerPx <= this.minBpPerPx
        },
        /**
         * !getter
         */
        get tooSmallToLock() {
          return this.minBpPerPx <= 0.0000000001
        },
        /**
         * !getter
         */
        get figureDimensions(): [number, number] {
          return [
            this.radiusPx * 2 + 2 * self.paddingPx,
            this.radiusPx * 2 + 2 * self.paddingPx,
          ]
        },
        /**
         * !getter
         */
        get figureWidth() {
          return this.figureDimensions[0]
        },
        /**
         * !getter
         */
        get figureHeight() {
          return this.figureDimensions[1]
        },
        /**
         * !getter
         * this is displayedRegions, post-processed to
         * elide regions that are too small to see reasonably
         */
        get elidedRegions() {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const visible: any[] = []
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
        /**
         * !getter
         */
        get assemblyNames() {
          const assemblyNames: string[] = []
          self.displayedRegions.forEach(displayedRegion => {
            if (!assemblyNames.includes(displayedRegion.assemblyName)) {
              assemblyNames.push(displayedRegion.assemblyName)
            }
          })
          return assemblyNames
        },
        /**
         * !getter
         */
        get initialized() {
          const { assemblyManager } = getSession(self)
          return this.assemblyNames.every(
            a => assemblyManager.get(a)?.initialized,
          )
        },
      }))
      .views(self => ({
        /**
         * !getter
         */
        get visibleStaticSlices() {
          return self.staticSlices.filter(s => sliceIsVisible(self, s))
        },
      }))
      .volatile(() => ({
        error: undefined as unknown,
      }))
      .actions(self => ({
        /**
         * !action
         */
        setWidth(newWidth: number) {
          self.width = Math.max(newWidth, minWidth)
          return self.width
        },
        /**
         * !action
         */
        setHeight(newHeight: number) {
          self.height = Math.max(newHeight, minHeight)
          return self.height
        },
        /**
         * !action
         */
        resizeHeight(distance: number) {
          const oldHeight = self.height
          const newHeight = this.setHeight(self.height + distance)
          this.setModelViewWhenAdjust(!self.tooSmallToLock)
          return newHeight - oldHeight
        },
        /**
         * !action
         */
        resizeWidth(distance: number) {
          const oldWidth = self.width
          const newWidth = this.setWidth(self.width + distance)
          this.setModelViewWhenAdjust(!self.tooSmallToLock)
          return newWidth - oldWidth
        },
        /**
         * !action
         */
        rotateClockwiseButton() {
          this.rotateClockwise(Math.PI / 6)
        },

        /**
         * !action
         */
        rotateCounterClockwiseButton() {
          this.rotateCounterClockwise(Math.PI / 6)
        },

        /**
         * !action
         */
        rotateClockwise(distance = 0.17) {
          self.offsetRadians += distance
        },

        /**
         * !action
         */
        rotateCounterClockwise(distance = 0.17) {
          self.offsetRadians -= distance
        },

        /**
         * !action
         */
        zoomInButton() {
          this.setBpPerPx(self.bpPerPx / 1.4)
        },

        /**
         * !action
         */
        zoomOutButton() {
          this.setBpPerPx(self.bpPerPx * 1.4)
        },

        /**
         * !action
         */
        setBpPerPx(newVal: number) {
          self.bpPerPx = clamp(newVal, self.minBpPerPx, self.maxBpPerPx)
        },

        /**
         * !action
         */
        setModelViewWhenAdjust(secondCondition: boolean) {
          if (self.lockedFitToWindow && secondCondition) {
            this.setBpPerPx(self.minBpPerPx)
          }
        },

        /**
         * !action
         */
        closeView() {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          getParent<any>(self, 2).removeView(self)
        },

        /**
         * !action
         */
        setDisplayedRegions(regions: SnapshotOrInstance<typeof Region>[]) {
          const previouslyEmpty = self.displayedRegions.length === 0
          self.displayedRegions = cast(regions)

          if (previouslyEmpty) {
            this.setBpPerPx(self.minBpPerPx)
          } else {
            this.setBpPerPx(self.bpPerPx)
          }
        },

        /**
         * !action
         */
        activateTrackSelector() {
          if (self.trackSelectorType === 'hierarchical') {
            const session = getSession(self)
            if (isSessionModelWithWidgets(session)) {
              const selector = session.addWidget(
                'HierarchicalTrackSelectorWidget',
                'hierarchicalTrackSelector',
                { view: self },
              )
              session.showWidget(selector)
              return selector
            }
          }
          throw new Error(
            `invalid track selector type ${self.trackSelectorType}`,
          )
        },

        /**
         * !action
         */
        toggleTrack(trackId: string) {
          // if we have any tracks with that configuration, turn them off
          const hiddenCount = this.hideTrack(trackId)
          // if none had that configuration, turn one on
          if (!hiddenCount) {
            this.showTrack(trackId)
          }
        },

        /**
         * !action
         */
        setError(error: unknown) {
          console.error(error)
          self.error = error
        },

        /**
         * !action
         */
        showTrack(trackId: string, initialSnapshot = {}) {
          const schema = pluginManager.pluggableConfigSchemaType('track')
          const conf = resolveIdentifier(schema, getRoot(self), trackId)
          const trackType = pluginManager.getTrackType(conf.type)
          if (!trackType) {
            throw new Error(`unknown track type ${conf.type}`)
          }
          const viewType = pluginManager.getViewType(self.type)
          const supportedDisplays = viewType.displayTypes.map(d => d.name)
          const displayConf = conf.displays.find((d: AnyConfigurationModel) =>
            supportedDisplays.includes(d.type),
          )
          const track = trackType.stateModel.create({
            ...initialSnapshot,
            type: conf.type,
            configuration: conf,
            displays: [{ type: displayConf.type, configuration: displayConf }],
          })
          self.tracks.push(track)
        },

        /**
         * !action
         */
        addTrackConf(
          configuration: AnyConfigurationModel,
          initialSnapshot = {},
        ) {
          const { type } = configuration
          const name = readConfObject(configuration, 'name')
          const trackType = pluginManager.getTrackType(type)
          if (!trackType) {
            throw new Error(`unknown track type ${configuration.type}`)
          }
          const viewType = pluginManager.getViewType(self.type)
          const supportedDisplays = viewType.displayTypes.map(d => d.name)
          const displayConf = configuration.displays.find(
            (d: AnyConfigurationModel) => supportedDisplays.includes(d.type),
          )
          const track = trackType.stateModel.create({
            ...initialSnapshot,
            name,
            type,
            configuration,
            displays: [{ type: displayConf.type, configuration: displayConf }],
          })
          self.tracks.push(track)
        },

        /**
         * !action
         */
        hideTrack(trackId: string) {
          const schema = pluginManager.pluggableConfigSchemaType('track')
          const conf = resolveIdentifier(schema, getRoot(self), trackId)
          const t = self.tracks.filter(t => t.configuration === conf)
          transaction(() => t.forEach(t => self.tracks.remove(t)))
          return t.length
        },

        /**
         * !action
         */
        toggleFitToWindowLock() {
          // when going unlocked -> locked and circle is cut off, set to the locked minBpPerPx
          self.lockedFitToWindow = !self.lockedFitToWindow
          this.setModelViewWhenAdjust(self.atMinBpPerPx)
          return self.lockedFitToWindow
        },
      })),
  )
}

export type CircularViewStateModel = ReturnType<typeof stateModelFactory>
export type CircularViewModel = Instance<CircularViewStateModel>

/*
PLANS

- tracks
- ruler tick marks
- set viewport scroll from state snapshot

*/

export default stateModelFactory

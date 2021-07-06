import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  SnapshotOrInstance,
  Instance,
  types,
  getParent,
  resolveIdentifier,
  getRoot,
  cast,
} from 'mobx-state-tree'
import { Region } from '@jbrowse/core/util/types/mst'
import { transaction } from 'mobx'
import { readConfObject } from '@jbrowse/core/configuration'
import {
  getSession,
  clamp,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { calculateStaticSlices, sliceIsVisible } from './slices'

import { viewportVisibleSection } from './viewportVisibleRegion'

export default function CircularView(pluginManager: PluginManager) {
  const minHeight = 40
  const minWidth = 100
  const defaultHeight = 400
  return types.compose(
    BaseViewModel,
    types
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
          return this.staticSlices.filter(sliceIsVisible.bind(this, self))
        },
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
        get circumferencePx() {
          let elidedBp = 0
          for (const r of this.elidedRegions) {
            elidedBp += r.widthBp
          }
          return (
            elidedBp / self.bpPerPx + self.spacingPx * this.elidedRegions.length
          )
        },
        get radiusPx() {
          return this.circumferencePx / (2 * Math.PI)
        },
        get bpPerRadian() {
          return self.bpPerPx * this.radiusPx
        },
        get pxPerRadian() {
          return this.radiusPx
        },
        get centerXY(): [number, number] {
          return [
            this.radiusPx + self.paddingPx,
            this.radiusPx + self.paddingPx,
          ]
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
          return this.totalBp / minCircumferencePx
        },
        get minBpPerPx() {
          // min depends on window dimensions, clamp between old min(0.01) and max
          const maxCircumferencePx = 2 * Math.PI * this.maximumRadiusPx
          return clamp(
            this.totalBp / maxCircumferencePx,
            0.0000000001,
            this.maxBpPerPx,
          )
        },
        get atMaxBpPerPx() {
          return self.bpPerPx >= this.maxBpPerPx
        },
        get atMinBpPerPx() {
          return self.bpPerPx <= this.minBpPerPx
        },
        get tooSmallToLock() {
          return this.minBpPerPx <= 0.0000000001
        },
        get figureDimensions() {
          return [
            this.radiusPx * 2 + 2 * self.paddingPx,
            this.radiusPx * 2 + 2 * self.paddingPx,
          ]
        },
        get figureWidth() {
          return this.figureDimensions[0]
        },
        get figureHeight() {
          return this.figureDimensions[1]
        },
        // this is displayedRegions, post-processed to
        // elide regions that are too small to see reasonably
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

        get assemblyNames() {
          const assemblyNames: string[] = []
          self.displayedRegions.forEach(displayedRegion => {
            if (!assemblyNames.includes(displayedRegion.assemblyName)) {
              assemblyNames.push(displayedRegion.assemblyName)
            }
          })
          return assemblyNames
        },
      }))
      .volatile(() => ({
        error: undefined as Error | undefined,
      }))
      .actions(self => ({
        // toggle action with a flag stating which mode it's in
        setWidth(newWidth: number) {
          self.width = Math.max(newWidth, minWidth)
          return self.width
        },
        setHeight(newHeight: number) {
          self.height = Math.max(newHeight, minHeight)
          return self.height
        },
        resizeHeight(distance: number) {
          const oldHeight = self.height
          const newHeight = this.setHeight(self.height + distance)
          this.setModelViewWhenAdjust(!self.tooSmallToLock)
          return newHeight - oldHeight
        },
        resizeWidth(distance: number) {
          const oldWidth = self.width
          const newWidth = this.setWidth(self.width + distance)
          this.setModelViewWhenAdjust(!self.tooSmallToLock)
          return newWidth - oldWidth
        },
        rotateClockwiseButton() {
          this.rotateClockwise(Math.PI / 6)
        },

        rotateCounterClockwiseButton() {
          this.rotateCounterClockwise(Math.PI / 6)
        },

        rotateClockwise(distance = 0.17) {
          self.offsetRadians += distance
        },

        rotateCounterClockwise(distance = 0.17) {
          self.offsetRadians -= distance
        },

        zoomInButton() {
          this.setBpPerPx(self.bpPerPx / 1.4)
        },

        zoomOutButton() {
          this.setBpPerPx(self.bpPerPx * 1.4)
        },

        setBpPerPx(newVal: number) {
          self.bpPerPx = clamp(newVal, self.minBpPerPx, self.maxBpPerPx)
        },

        setModelViewWhenAdjust(secondCondition: boolean) {
          if (self.lockedFitToWindow && secondCondition) {
            this.setBpPerPx(self.minBpPerPx)
          }
        },

        closeView() {
          getParent(self, 2).removeView(self)
        },

        setDisplayedRegions(regions: SnapshotOrInstance<typeof Region>[]) {
          const previouslyEmpty = self.displayedRegions.length === 0
          self.displayedRegions = cast(regions)

          if (previouslyEmpty) {
            this.setBpPerPx(self.minBpPerPx)
          } else {
            this.setBpPerPx(self.bpPerPx)
          }
        },

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

        toggleTrack(trackId: string) {
          // if we have any tracks with that configuration, turn them off
          const hiddenCount = this.hideTrack(trackId)
          // if none had that configuration, turn one on
          if (!hiddenCount) {
            this.showTrack(trackId)
          }
        },

        setError(error: Error) {
          console.error(error)
          self.error = error
        },

        showTrack(trackId: string, initialSnapshot = {}) {
          const trackConfigSchema = pluginManager.pluggableConfigSchemaType(
            'track',
          )
          const configuration = resolveIdentifier(
            trackConfigSchema,
            getRoot(self),
            trackId,
          )
          const trackType = pluginManager.getTrackType(configuration.type)
          if (!trackType) {
            throw new Error(`unknown track type ${configuration.type}`)
          }
          const viewType = pluginManager.getViewType(self.type)
          const supportedDisplays = viewType.displayTypes.map(
            displayType => displayType.name,
          )
          const displayConf = configuration.displays.find(
            (d: AnyConfigurationModel) => supportedDisplays.includes(d.type),
          )
          const track = trackType.stateModel.create({
            ...initialSnapshot,
            type: configuration.type,
            configuration,
            displays: [{ type: displayConf.type, configuration: displayConf }],
          })
          self.tracks.push(track)
        },

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
          const supportedDisplays = viewType.displayTypes.map(
            displayType => displayType.name,
          )
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

        hideTrack(trackId: string) {
          const trackConfigSchema = pluginManager.pluggableConfigSchemaType(
            'track',
          )
          const configuration = resolveIdentifier(
            trackConfigSchema,
            getRoot(self),
            trackId,
          )
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
          this.setModelViewWhenAdjust(self.atMinBpPerPx)
          return self.lockedFitToWindow
        },
      })),
  )
}

export type CircularViewStateModel = ReturnType<typeof CircularView>
export type CircularViewModel = Instance<CircularViewStateModel>

/*
PLANS

- tracks
- ruler tick marks
- set viewport scroll from state snapshot

*/

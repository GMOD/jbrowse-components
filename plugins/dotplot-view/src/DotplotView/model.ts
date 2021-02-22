/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Instance,
  SnapshotIn,
  cast,
  types,
  getParent,
  getSnapshot,
  addDisposer,
  resolveIdentifier,
  getRoot,
  IAnyModelType,
} from 'mobx-state-tree'

import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { observable, autorun, transaction } from 'mobx'
import { BaseTrackStateModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import Base1DView, { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import {
  getSession,
  minmax,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'

function approxPixelStringLen(str: string) {
  return str.length * 0.7 * 12
}

type Coord = [number, number]

// Used in the renderer
// ref https://mobx-state-tree.js.org/concepts/volatiles on volatile state used here
export const Dotplot1DView = Base1DView.extend(self => {
  const scaleFactor = observable.box(1)
  return {
    views: {
      get dynamicBlocks() {
        return calculateDynamicBlocks(self, false, false)
      },
      get scaleFactor() {
        return scaleFactor.get()
      },
    },
    actions: {
      setScaleFactor(n: number) {
        scaleFactor.set(n)
      },
    },
  }
})

export type Dotplot1DViewModel = Instance<typeof Dotplot1DView>

const DotplotHView = Dotplot1DView.extend(self => ({
  views: {
    get width() {
      return getParent<any>(self).viewWidth
    },
  },
}))

const DotplotVView = Dotplot1DView.extend(self => ({
  views: {
    get width() {
      return getParent<any>(self).viewHeight
    },
  },
}))

export default function stateModelFactory(pluginManager: PluginManager) {
  return types.compose(
    BaseViewModel,
    types
      .model('DotplotView', {
        id: ElementId,
        type: types.literal('DotplotView'),
        headerHeight: 0,
        height: 600,
        borderSize: 20,
        tickSize: 5,
        vtextRotation: 0,
        htextRotation: -90,
        fontSize: 15,
        trackSelectorType: 'hierarchical',
        assemblyNames: types.array(types.string),
        hview: types.optional(DotplotHView, {}),
        vview: types.optional(DotplotVView, {}),

        tracks: types.array(
          pluginManager.pluggableMstType(
            'track',
            'stateModel',
          ) as BaseTrackStateModel,
        ),

        // this represents tracks specific to this view
        // specifically used for read vs ref dotplots where
        // this track would not really apply elsewhere
        viewTrackConfigs: types.array(
          pluginManager.pluggableConfigSchemaType('track'),
        ),

        // this represents assemblies in the specialized
        // read vs ref dotplot view
        viewAssemblyConfigs: types.array(types.frozen()),
      })
      .volatile(() => ({
        volatileWidth: undefined as number | undefined,
        error: undefined as Error | undefined,
        borderX: 100,
        borderY: 100,
      }))
      .views(self => ({
        get width(): number {
          if (!self.volatileWidth) {
            throw new Error('width not initialized')
          }
          return self.volatileWidth
        },
      }))
      .views(self => ({
        get initialized() {
          return (
            self.volatileWidth !== undefined &&
            self.hview.displayedRegions.length > 0 &&
            self.vview.displayedRegions.length > 0
          )
        },
        get loading() {
          return self.assemblyNames.length > 0 && !this.initialized
        },
        get viewWidth() {
          return self.width - self.borderX
        },
        get viewHeight() {
          return self.height - self.borderY
        },
        get views() {
          return [self.hview, self.vview]
        },

        get renderProps() {
          return {
            ...getParentRenderProps(self),
            highResolutionScaling: getConf(
              getSession(self),
              'highResolutionScaling',
            ),
          }
        },
      }))
      .actions(self => ({
        afterAttach() {
          const session = getSession(self)
          addDisposer(
            self,
            autorun(
              () => {
                if (self.volatileWidth !== undefined) {
                  const axis = [self.viewWidth, self.viewHeight]
                  const views = [self.hview, self.vview]
                  if (!self.initialized) {
                    self.assemblyNames.forEach((name, index) => {
                      const assembly = session.assemblyManager.get(name)
                      if (assembly) {
                        const { regions } = assembly
                        if (regions && regions.length) {
                          const regionsSnapshot = getSnapshot(regions)
                          if (regionsSnapshot) {
                            transaction(() => {
                              views[index].setDisplayedRegions(regionsSnapshot)
                              views[index].setBpPerPx(
                                views[index].totalBp / axis[index],
                              )
                            })
                          }
                        }
                      }
                    })
                  }
                }
              },
              { delay: 1000 },
            ),
          )
          addDisposer(
            self,
            autorun(() => {
              // make sure we have a width on the view before trying to load
              if (self.volatileWidth !== undefined) {
                const padding = 10
                // these are set via autorun to avoid dependency cycle
                this.setBorderY(
                  Math.max(
                    self.hview.dynamicBlocks.contentBlocks.reduce(
                      (a, b) =>
                        Math.max(
                          a,
                          approxPixelStringLen(b.refName.slice(0, 30)),
                        ),
                      0,
                    ) + padding,
                    100,
                  ),
                )
                this.setBorderX(
                  Math.max(
                    self.vview.dynamicBlocks.contentBlocks.reduce(
                      (a, b) =>
                        Math.max(
                          a,
                          approxPixelStringLen(b.refName.slice(0, 30)),
                        ),
                      0,
                    ) + padding,
                    100,
                  ),
                )
              }
            }),
          )
        },
        setBorderX(n: number) {
          self.borderX = n
        },
        setBorderY(n: number) {
          self.borderY = n
        },
        setWidth(newWidth: number) {
          self.volatileWidth = newWidth
        },
        setHeight(newHeight: number) {
          self.height = newHeight
        },

        setError(e: Error) {
          self.error = e
        },

        closeView() {
          getParent<any>(self, 2).removeView(self)
        },

        setHeaderHeight(height: number) {
          self.headerHeight = height
        },

        zoomOutButton() {
          self.hview.zoomOut()
          self.vview.zoomOut()
        },
        zoomInButton() {
          self.hview.zoomIn()
          self.vview.zoomIn()
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
          throw new Error(
            `invalid track selector type ${self.trackSelectorType}`,
          )
        },

        showTrack(trackId: string, initialSnapshot = {}) {
          const trackConfigSchema = pluginManager.pluggableConfigSchemaType(
            'track',
          )
          const configuration = resolveIdentifier(
            trackConfigSchema as IAnyModelType,
            getRoot(self),
            trackId,
          )
          const trackType = pluginManager.getTrackType(configuration.type)
          if (!trackType) {
            throw new Error(`unknown track type ${configuration.type}`)
          }
          const viewType = pluginManager.getViewType(self.type)
          const displayConf = configuration.displays.find(
            (d: AnyConfigurationModel) => {
              if (
                viewType.displayTypes.find(
                  displayType => displayType.name === d.type,
                )
              ) {
                return true
              }
              return false
            },
          )
          if (!displayConf) {
            throw new Error(
              `could not find a compatible display for view type ${self.type}`,
            )
          }
          const track = trackType.stateModel.create({
            ...initialSnapshot,
            type: configuration.type,
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
            trackConfigSchema as IAnyModelType,
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

        toggleTrack(trackId: string) {
          // if we have any tracks with that configuration, turn them off
          const hiddenCount = this.hideTrack(trackId)
          // if none had that configuration, turn one on
          if (!hiddenCount) {
            this.showTrack(trackId)
          }
        },
        setAssemblyNames(assemblyNames: string[]) {
          self.assemblyNames = cast(assemblyNames)
        },
        setViews(arr: SnapshotIn<Base1DViewModel>[]) {
          self.hview = cast(arr[0])
          self.vview = cast(arr[1])
        },

        getCoords(mousedown: Coord, mouseup: Coord) {
          const [xmin, xmax] = minmax(mouseup[0], mousedown[0])
          const [ymin, ymax] = minmax(mouseup[1], mousedown[1])
          return Math.abs(xmax - xmin) > 3 && Math.abs(ymax - ymin) > 3
            ? [
                self.hview.pxToBp(xmin),
                self.hview.pxToBp(xmax),
                self.vview.pxToBp(self.viewHeight - ymin),
                self.vview.pxToBp(self.viewHeight - ymax),
              ]
            : undefined
        },

        zoomIn(mousedown: Coord, mouseup: Coord) {
          const result = this.getCoords(mousedown, mouseup)
          if (result) {
            const [x1, x2, y1, y2] = result
            self.hview.moveTo(x1, x2)
            self.vview.moveTo(y2, y1)
          }
        },
        onDotplotView(mousedown: Coord, mouseup: Coord) {
          const result = this.getCoords(mousedown, mouseup)
          if (result) {
            const [x1, x2, y1, y2] = result
            const session = getSession(self)

            const d1 = Dotplot1DView.create({
              ...getSnapshot(self.hview),
              minimumBlockWidth: 0,
              interRegionPaddingWidth: 0,
            })
            const d2 = Dotplot1DView.create({
              ...getSnapshot(self.vview),
              minimumBlockWidth: 0,
              interRegionPaddingWidth: 0,
            })
            d1.setVolatileWidth(self.hview.width)
            d2.setVolatileWidth(self.vview.width)
            d1.moveTo(x1, x2)
            d2.moveTo(y2, y1)
            d1.zoomTo(d1.bpPerPx / (self.width / self.hview.width), 0)
            d2.zoomTo(d2.bpPerPx / (self.width / self.vview.width), 0)

            // add the specific evidence tracks to the LGVs in the split view
            // note: scales the bpPerPx by scaling proportional of the dotplot
            // width to the eventual lgv width
            const tracks: {
              type: string
              configuration: AnyConfigurationModel
              displays: {
                type: string
                configuration: AnyConfigurationModel
              }[]
            }[] = []
            self.tracks.forEach(track => {
              const trackConf = track.configuration
              const displayConf = trackConf.displays.find(
                (display: AnyConfigurationModel) =>
                  display.type === 'LinearSyntenyDisplay',
              )
              if (displayConf) {
                tracks.push({
                  type: trackConf.type,
                  configuration: trackConf,
                  displays: [
                    { type: displayConf.type, configuration: displayConf },
                  ],
                })
              }
            })
            const viewSnapshot = {
              type: 'LinearSyntenyView',
              views: [
                {
                  type: 'LinearGenomeView',
                  ...getSnapshot(d1),
                  tracks: [],
                  hideHeader: true,
                },
                {
                  type: 'LinearGenomeView',
                  ...getSnapshot(d2),
                  tracks: [],
                  hideHeader: true,
                },
              ],
              tracks,
            }

            session.addView('LinearSyntenyView', viewSnapshot)
          }
        },
      }))
      .views(self => ({
        get menuItems() {
          const session = getSession(self)
          if (isSessionModelWithWidgets(session)) {
            return [
              {
                label: 'Open track selector',
                onClick: self.activateTrackSelector,
              },
            ]
          }
          return []
        },
      })),
  )
}

export type DotplotViewStateModel = ReturnType<typeof stateModelFactory>
export type DotplotViewModel = Instance<DotplotViewStateModel>

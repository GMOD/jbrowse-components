/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSession, clamp } from '@gmod/jbrowse-core/util'
import { Region, IRegion } from '@gmod/jbrowse-core/mst-types'

import { types, Instance } from 'mobx-state-tree'
import { autorun, transaction } from 'mobx'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'

import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { BaseTrackStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/baseTrackModel'
import calculateDynamicBlocks from './calculateDynamicBlocks'
import calculateStaticBlocks from './calculateStaticBlocks'

export type LGV = Instance<LinearGenomeViewStateModel>

type ConfigRelationship = { type: string; target: string }
interface BpOffset {
  refName?: string
  index: number
  offset: number
  start?: number
  end?: number
}

function approxPixelStringLen(str: string) {
  return str.length * 0.7 * 12
}
export default function stateModelFactory(pluginManager: any) {
  const { jbrequire } = pluginManager
  const { cast, types: jbrequiredTypes, getParent, addDisposer } = jbrequire(
    'mobx-state-tree',
  )
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')

  const DotplotViewDirection = (jbrequiredTypes as Instance<typeof types>)
    .model('DotplotViewDirection', {
      displayedRegions: types.array(Region),
      bpPerPx: types.number,
      offsetPx: types.number,
      horizontallyFlipped: false,
    })
    .volatile(() => ({
      features: undefined as undefined | Feature[],
    }))
    .actions(self => ({
      setDisplayedRegions(regions: IRegion[]) {
        self.displayedRegions = cast(regions)
      },
      setBpPerPx(val: number) {
        self.bpPerPx = val
      },
    }))
    .views(self => ({
      get width() {
        /* this is replaced by usage of this model */
        return 0
      },

      get displayedRegionsTotalPx() {
        return this.totalBp / self.bpPerPx
      },

      get maxOffset() {
        // objectively determined to keep the linear genome on the main screen
        const leftPadding = 10
        return this.displayedRegionsTotalPx - leftPadding
      },

      get minOffset() {
        // objectively determined to keep the linear genome on the main screen
        const rightPadding = 30
        return -this.width + rightPadding
      },
      get dynamicBlocks() {
        return calculateDynamicBlocks(cast(self))
      },
      get staticBlocks() {
        return calculateStaticBlocks(cast(self))
      },
      get totalBp() {
        return self.displayedRegions
          .map(a => a.end - a.start)
          .reduce((a, b) => a + b, 0)
      },
      get currBp() {
        return this.dynamicBlocks
          .map(a => a.end - a.start)
          .reduce((a, b) => a + b, 0)
      },
      bpToPx(refName: string, coord: number) {
        let offsetBp = 0

        const index = self.displayedRegions.findIndex(r => {
          if (refName === r.refName && coord >= r.start && coord <= r.end) {
            offsetBp += self.horizontallyFlipped
              ? r.end - coord
              : coord - r.start
            return true
          }
          offsetBp += r.end - r.start
          return false
        })
        const foundRegion = self.displayedRegions[index]
        if (foundRegion) {
          return Math.round(offsetBp / self.bpPerPx)
        }
        return undefined
      },

      /**
       *
       * @param {number} px px in the view area, return value is the displayed regions
       * @returns {BpOffset} of the displayed region that it lands in
       */
      pxToBp(px: number) {
        const bp = (self.offsetPx + px) * self.bpPerPx
        let bpSoFar = 0
        let r = self.displayedRegions[0]
        if (bp < 0) {
          return {
            ...r,
            offset: bp,
            index: 0,
          }
        }
        for (let index = 0; index < self.displayedRegions.length; index += 1) {
          r = self.displayedRegions[index]
          if (r.end - r.start + bpSoFar > bp && bpSoFar <= bp) {
            return { ...r, offset: bp - bpSoFar, index }
          }
          bpSoFar += r.end - r.start
        }

        return {
          ...r,
          offset: bp - bpSoFar,
          index: self.displayedRegions.length - 1,
        }
      },
    }))
    .actions(self => ({
      zoomInButton() {
        this.zoomTo(self.bpPerPx / 1.4)
      },

      zoomOutButton() {
        this.zoomTo(self.bpPerPx * 1.4)
      },
      zoomTo(newBpPerPx: number, offset: number = self.width / 2) {
        const bpPerPx = newBpPerPx
        if (bpPerPx === self.bpPerPx) return
        const oldBpPerPx = self.bpPerPx
        self.bpPerPx = bpPerPx
        self.offsetPx = Math.round(
          ((self.offsetPx + offset) * oldBpPerPx) / bpPerPx - offset,
        )
      },
      horizontalScroll(distance: number) {
        const oldOffsetPx = self.offsetPx
        // the scroll is clamped to keep the linear genome on the main screen
        const newOffsetPx = clamp(
          self.offsetPx + distance,
          self.minOffset,
          self.maxOffset,
        )
        self.offsetPx = newOffsetPx
        return newOffsetPx - oldOffsetPx
      },
      moveTo(start: BpOffset, end: BpOffset) {
        // find locations in the modellist
        let bpSoFar = 0
        if (start.index === end.index) {
          bpSoFar += end.offset - start.offset
        } else {
          const s = self.displayedRegions[start.index]
          bpSoFar += (s.reversed ? s.start : s.end) - start.offset
          if (end.index - start.index >= 2) {
            for (let i = start.index + 1; i < end.index; i += 1) {
              bpSoFar +=
                self.displayedRegions[i].end - self.displayedRegions[i].start
            }
          }
          bpSoFar += end.offset
        }
        let bpToStart = 0
        for (let i = 0; i < self.displayedRegions.length; i += 1) {
          const region = self.displayedRegions[i]
          if (start.index === i) {
            bpToStart += start.offset
            break
          } else {
            bpToStart += region.end - region.start
          }
        }
        self.bpPerPx = bpSoFar / self.width
        const viewWidth = self.width
        if (viewWidth > bpSoFar / self.bpPerPx) {
          self.offsetPx = Math.round(
            bpToStart / self.bpPerPx - (viewWidth - bpSoFar / self.bpPerPx) / 2,
          )
        } else {
          self.offsetPx = Math.round(bpToStart / self.bpPerPx)
        }
      },
    }))
  return (jbrequiredTypes as Instance<typeof types>)
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
      displayName: 'dotplot',
      trackSelectorType: 'hierarchical',
      assemblyNames: types.array(types.string),
      hview: DotplotViewDirection.extend(self => ({
        views: {
          get width() {
            return getParent(self).viewWidth
          },
        },
      })),
      vview: DotplotViewDirection.extend(self => ({
        views: {
          get width() {
            return getParent(self).viewHeight
          },
        },
      })),
      tracks: types.array(
        pluginManager.pluggableMstType(
          'track',
          'stateModel',
        ) as BaseTrackStateModel,
      ),
    })
    .volatile(() => ({
      width: 800,
      error: undefined as Error | undefined,
      borderX: 0,
      borderY: 0,
    }))
    .views(self => ({
      get initialized() {
        return (
          self.hview.displayedRegions.length > 0 &&
          self.vview.displayedRegions.length > 0
        )
      },

      get loading() {
        return self.assemblyNames.length > 0 && !this.initialized
      },
      get viewWidth() {
        return self.width - self.borderSize - self.borderX
      },
      get viewHeight() {
        return self.height - self.borderSize - self.borderY
      },
      get views() {
        return [self.hview, self.vview]
      },
    }))
    .actions(self => ({
      afterAttach() {
        const session = getSession(self) as any
        addDisposer(
          self,
          autorun(
            async () => {
              const axis = [self.viewWidth, self.viewHeight]
              const views = [self.hview, self.vview]
              if (!self.initialized) {
                self.assemblyNames.forEach(async (name, index) => {
                  session
                    .getRegionsForAssemblyName(name)
                    .then((regions: IRegion[] | undefined) => {
                      if (regions !== undefined) {
                        views[index].setDisplayedRegions(regions)
                        views[index].setBpPerPx(
                          views[index].totalBp / axis[index],
                        )
                      } else {
                        this.setError(
                          new Error(
                            `failed to get regions for assembly ${self.assemblyNames[index]}`,
                          ),
                        )
                      }
                    })
                    .catch((e: Error) => {
                      this.setError(e)
                    })
                })
              }
            },
            { delay: 1000 },
          ),
        )
        addDisposer(
          self,
          autorun(async () => {
            const padding = 4
            // these are set via autorun to avoid dependency cycle
            this.setBorderY(
              self.hview.dynamicBlocks.blocks.reduce(
                (a, b) => Math.max(a, approxPixelStringLen(b.refName)),
                0,
              ) + padding,
            )
            this.setBorderX(
              self.vview.dynamicBlocks.blocks.reduce(
                (a, b) => Math.max(a, approxPixelStringLen(b.refName)),
                0,
              ) + padding,
            )
          }),
        )
      },
      setDisplayName(name: string) {
        self.displayName = name
      },
      setBorderX(n: number) {
        self.borderX = n
      },
      setBorderY(n: number) {
        self.borderY = n
      },

      setWidth(newWidth: number) {
        self.width = newWidth
      },
      setHeight(newHeight: number) {
        self.height = newHeight
      },

      setError(e: Error) {
        self.error = e
      },

      closeView() {
        getParent(self, 2).removeView(self)
      },

      setHeaderHeight(height: number) {
        self.headerHeight = height
      },

      zoomOutButton() {
        self.hview.zoomOutButton()
        self.vview.zoomOutButton()
      },
      zoomInButton() {
        self.hview.zoomInButton()
        self.vview.zoomInButton()
      },
      activateTrackSelector() {
        if (self.trackSelectorType === 'hierarchical') {
          const session: any = getSession(self)
          const selector = session.addDrawerWidget(
            'HierarchicalTrackSelectorDrawerWidget',
            'hierarchicalTrackSelector',
            { view: self },
          )
          session.showDrawerWidget(selector)
          return selector
        }
        throw new Error(`invalid track selector type ${self.trackSelectorType}`)
      },

      toggleTrack(configuration: any) {
        // if we have any tracks with that configuration, turn them off
        const hiddenCount = this.hideTrack(configuration)
        // if none had that configuration, turn one on
        if (!hiddenCount) this.showTrack(configuration)
      },

      showTrack(configuration: any, initialSnapshot = {}) {
        const { type } = configuration
        if (!type) {
          throw new Error('track configuration has no `type` listed')
        }

        const name = readConfObject(configuration, 'name')
        const trackType = pluginManager.getTrackType(type)

        if (!trackType) {
          throw new Error(`unknown track type ${type}`)
        }
        self.tracks.push({
          ...initialSnapshot,
          name,
          type,
          configuration,
        })
      },

      hideTrack(configuration: any) {
        // if we have any tracks with that configuration, turn them off
        const shownTracks = self.tracks.filter(
          t => t.configuration === configuration,
        )
        transaction(() => shownTracks.forEach(t => self.tracks.remove(t)))
        return shownTracks.length
      },
      setAssemblyNames(assemblyNames: string[]) {
        self.assemblyNames = cast(assemblyNames)
      },
      setViews(arr: any[]) {
        self.hview = cast(arr[0])
        self.vview = cast(arr[1])
      },
    }))
    .views(self => ({
      get menuOptions() {
        const session: any = getSession(self)
        return [
          {
            label: 'Open track selector',
            onClick: self.activateTrackSelector,
            disabled:
              session.visibleDrawerWidget &&
              session.visibleDrawerWidget.id === 'hierarchicalTrackSelector' &&
              session.visibleDrawerWidget.view.id === self.id,
          },
        ]
      },
    }))
}

export type DotplotViewStateModel = ReturnType<typeof stateModelFactory>
export type DotplotViewModel = Instance<DotplotViewStateModel>

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getConf } from '@jbrowse/core/configuration'
import { MenuItem } from '@jbrowse/core/ui'
import {
  isAbortException,
  getContainingView,
  getContainingTrack,
  getSession,
  getViewParams,
  isSelectionContainer,
  isSessionModelWithWidgets,
  isFeature,
  Feature,
  ReactRendering,
} from '@jbrowse/core/util'
import { Stats } from '@jbrowse/core/data_adapters/BaseAdapter'
import { BaseBlock } from '@jbrowse/core/util/blockTypes'
import { Region } from '@jbrowse/core/util/types'
import CompositeMap from '@jbrowse/core/util/compositeMap'
import {
  getParentRenderProps,
  getRpcSessionId,
} from '@jbrowse/core/util/tracks'
import { autorun } from 'mobx'
import { addDisposer, isAlive, types, Instance } from 'mobx-state-tree'

// icons
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

// locals
import { LinearGenomeViewModel, ExportSvgOptions } from '../../LinearGenomeView'
import { Tooltip } from '../components/BaseLinearDisplay'
import TooLargeMessage from '../components/TooLargeMessage'
import BlockState, { renderBlockData } from './serverSideRenderedBlock'
import { ThemeOptions } from '@mui/material'

type LGV = LinearGenomeViewModel

export interface Layout {
  minX: number
  minY: number
  maxX: number
  maxY: number
  name: string
}

// stabilize clipid under test for snapshot
function getId(id: string, index: number) {
  const isJest = typeof jest === 'undefined'
  return `clip-${isJest ? id : 'jest'}-${index}`
}

type LayoutRecord = [number, number, number, number]

function getDisplayStr(totalBytes: number) {
  let displayBp
  if (Math.floor(totalBytes / 1000000) > 0) {
    displayBp = `${Number.parseFloat((totalBytes / 1000000).toPrecision(3))} Mb`
  } else if (Math.floor(totalBytes / 1000) > 0) {
    displayBp = `${Number.parseFloat((totalBytes / 1000).toPrecision(3))} Kb`
  } else {
    displayBp = `${Math.floor(totalBytes)} bytes`
  }
  return displayBp
}

const minDisplayHeight = 20

/**
 * #stateModel BaseLinearDisplay
 * extends `BaseDisplay`
 */
function stateModelFactory() {
  return types
    .compose(
      'BaseLinearDisplay',
      BaseDisplay,
      types.model({
        /**
         * #property
         */
        heightPreConfig: types.maybe(
          types.refinement(
            'displayHeight',
            types.number,
            n => n >= minDisplayHeight,
          ),
        ),
        /**
         * #property
         * updated via autorun
         */
        blockState: types.map(BlockState),
        /**
         * #property
         */
        userBpPerPxLimit: types.maybe(types.number),
        /**
         * #property
         */
        userByteSizeLimit: types.maybe(types.number),
      }),
    )
    .volatile(() => ({
      currBpPerPx: 0,
      scrollTop: 0,
      message: '',
      featureIdUnderMouse: undefined as undefined | string,
      contextMenuFeature: undefined as undefined | Feature,
      estimatedRegionStatsP: undefined as undefined | Promise<Stats>,
      estimatedRegionStats: undefined as undefined | Stats,
    }))
    .views(self => ({
      get height() {
        return self.heightPreConfig ?? (getConf(self, 'height') as number)
      },
      /**
       * #getter
       */
      get blockType(): 'staticBlocks' | 'dynamicBlocks' {
        return 'staticBlocks'
      },
      /**
       * #getter
       */
      get blockDefinitions() {
        const { blockType } = this
        const view = getContainingView(self) as LGV
        if (!view.initialized) {
          throw new Error('view not initialized yet')
        }
        return view[blockType]
      },
    }))
    .views(self => ({
      /**
       * #getter
       * how many milliseconds to wait for the display to
       * "settle" before re-rendering a block
       */
      get renderDelay() {
        return 50
      },

      /**
       * #getter
       */
      get TooltipComponent(): React.FC<any> {
        return Tooltip as unknown as React.FC
      },

      /**
       * #getter
       * returns a string feature ID if the globally-selected object
       * is probably a feature
       */
      get selectedFeatureId() {
        if (isAlive(self)) {
          const { selection } = getSession(self)
          // does it quack like a feature?
          if (isFeature(selection)) {
            return selection.id()
          }
        }
        return undefined
      },
      /**
       * #getter
       * if a display-level message should be displayed instead of the blocks,
       * make this return a react component
       */
      get DisplayMessageComponent() {
        return undefined as undefined | React.FC<any>
      },
    }))
    .views(self => ({
      /**
       * #getter
       * a CompositeMap of `featureId -> feature obj` that
       * just looks in all the block data for that feature
       */
      get features() {
        const featureMaps = []
        for (const block of self.blockState.values()) {
          if (block && block.features) {
            featureMaps.push(block.features)
          }
        }
        return new CompositeMap(featureMaps)
      },

      /**
       * #getter
       */
      get featureUnderMouse() {
        const feat = self.featureIdUnderMouse
        return feat ? this.features.get(feat) : undefined
      },

      /**
       * #getter
       */
      getFeatureOverlapping(blockKey: string, x: number, y: number) {
        return self.blockState.get(blockKey)?.layout?.getByCoord(x, y)
      },

      /**
       * #getter
       */
      getFeatureByID(blockKey: string, id: string): LayoutRecord | undefined {
        return self.blockState.get(blockKey)?.layout?.getByID(id)
      },

      /**
       * #getter
       */
      searchFeatureByID(id: string): LayoutRecord | undefined {
        let ret
        self.blockState.forEach(block => {
          const val = block?.layout?.getByID(id)
          if (val) {
            ret = val
          }
        })
        return ret
      },

      /**
       * #getter
       */
      get currentBytesRequested() {
        return self.estimatedRegionStats?.bytes || 0
      },

      /**
       * #getter
       */
      get currentFeatureScreenDensity() {
        const view = getContainingView(self) as LGV
        return (self.estimatedRegionStats?.featureDensity || 0) * view.bpPerPx
      },

      /**
       * #getter
       */
      get maxFeatureScreenDensity() {
        return getConf(self, 'maxFeatureScreenDensity')
      },
      /**
       * #getter
       */
      get estimatedStatsReady() {
        return !!self.estimatedRegionStats
      },

      /**
       * #getter
       */
      get maxAllowableBytes() {
        return (
          self.userByteSizeLimit ||
          self.estimatedRegionStats?.fetchSizeLimit ||
          (getConf(self, 'fetchSizeLimit') as number)
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setMessage(message: string) {
        self.message = message
      },

      afterAttach() {
        // watch the parent's blocks to update our block state when they change,
        // then we recreate the blocks on our own model (creating and deleting to
        // match the parent blocks)
        const blockWatchDisposer = autorun(() => {
          const blocksPresent: { [key: string]: boolean } = {}
          const view = getContainingView(self) as LGV
          if (view.initialized) {
            self.blockDefinitions.contentBlocks.forEach(block => {
              blocksPresent[block.key] = true
              if (!self.blockState.has(block.key)) {
                this.addBlock(block.key, block)
              }
            })
            self.blockState.forEach((_, key) => {
              if (!blocksPresent[key]) {
                this.deleteBlock(key)
              }
            })
          }
        })

        addDisposer(self, blockWatchDisposer)
      },

      /**
       * #action
       */
      estimateRegionsStats(
        regions: Region[],
        opts: {
          headers?: Record<string, string>
          signal?: AbortSignal
          filters?: string[]
        },
      ) {
        if (self.estimatedRegionStatsP) {
          return self.estimatedRegionStatsP
        }

        const { rpcManager } = getSession(self)
        const { adapterConfig } = self
        if (!adapterConfig) {
          // A track extending the base track might not have an adapter config
          // e.g. Apollo tracks don't use adapters
          return Promise.resolve({})
        }
        const sessionId = getRpcSessionId(self)

        const params = {
          sessionId,
          regions,
          adapterConfig,
          statusCallback: (message: string) => {
            if (isAlive(self)) {
              this.setMessage(message)
            }
          },
          ...opts,
        }

        self.estimatedRegionStatsP = rpcManager
          .call(sessionId, 'CoreEstimateRegionStats', params)
          .catch(e => {
            this.setRegionStatsP(undefined)
            throw e
          }) as Promise<Stats>

        return self.estimatedRegionStatsP
      },
      /**
       * #action
       */
      setRegionStatsP(p?: Promise<Stats>) {
        self.estimatedRegionStatsP = p
      },
      /**
       * #action
       */
      setRegionStats(estimatedRegionStats?: Stats) {
        self.estimatedRegionStats = estimatedRegionStats
      },
      /**
       * #action
       */
      clearRegionStats() {
        self.estimatedRegionStatsP = undefined
        self.estimatedRegionStats = undefined
      },
      /**
       * #action
       */
      setHeight(displayHeight: number) {
        self.heightPreConfig =
          displayHeight > minDisplayHeight ? displayHeight : minDisplayHeight
        return self.height
      },
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = this.setHeight(self.height + distance)
        return newHeight - oldHeight
      },

      /**
       * #action
       */
      setScrollTop(scrollTop: number) {
        self.scrollTop = scrollTop
      },

      /**
       * #action
       */
      updateStatsLimit(stats: Stats) {
        const view = getContainingView(self) as LGV
        if (stats.bytes) {
          self.userByteSizeLimit = stats.bytes
        } else {
          self.userBpPerPxLimit = view.bpPerPx
        }
      },

      /**
       * #action
       */
      addBlock(key: string, block: BaseBlock) {
        self.blockState.set(
          key,
          BlockState.create({
            key,
            region: block.toRegion(),
          }),
        )
      },
      /**
       * #action
       */
      setCurrBpPerPx(n: number) {
        self.currBpPerPx = n
      },
      /**
       * #action
       */
      deleteBlock(key: string) {
        self.blockState.delete(key)
      },
      /**
       * #action
       */
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'BaseFeatureWidget',
            'baseFeature',
            {
              view: getContainingView(self),
              track: getContainingTrack(self),
              featureData: feature.toJSON(),
            },
          )

          session.showWidget(featureWidget)
        }
        if (isSelectionContainer(session)) {
          session.setSelection(feature)
        }
      },
      /**
       * #action
       */
      clearFeatureSelection() {
        const session = getSession(self)
        session.clearSelection()
      },
      /**
       * #action
       */
      setFeatureIdUnderMouse(feature: string | undefined) {
        self.featureIdUnderMouse = feature
      },
      /**
       * #action
       */
      reload() {
        ;[...self.blockState.values()].map(val => val.doReload())
      },
      /**
       * #action
       */
      setContextMenuFeature(feature?: Feature) {
        self.contextMenuFeature = feature
      },
    }))
    .views(self => ({
      /**
       * #getter
       * region is too large if:
       * - stats are ready
       * - region is greater than 20kb (don't warn when zoomed in less than that)
       * - and bytes is greater than max allowed bytes or density greater than max density
       */
      get regionTooLarge() {
        const view = getContainingView(self) as LGV
        if (!self.estimatedStatsReady || view.dynamicBlocks.totalBp < 20_000) {
          return false
        }
        const bpLimitOrDensity = self.userBpPerPxLimit
          ? view.bpPerPx > self.userBpPerPxLimit
          : self.currentFeatureScreenDensity > self.maxFeatureScreenDensity

        return (
          self.currentBytesRequested > self.maxAllowableBytes ||
          bpLimitOrDensity
        )
      },

      /**
       * #getter
       * only shows a message of bytes requested is defined, the feature density
       * based stats don't produce any helpful message besides to zoom in
       */
      get regionTooLargeReason() {
        const req = self.currentBytesRequested
        const max = self.maxAllowableBytes

        return req && req > max
          ? `Requested too much data (${getDisplayStr(req)})`
          : ''
      },
    }))
    .actions(self => {
      const { reload: superReload } = self

      return {
        /**
         * #action
         */
        async reload() {
          self.setError()
          const aborter = new AbortController()
          const view = getContainingView(self) as LGV

          // extra check for contentBlocks.length
          // https://github.com/GMOD/jbrowse-components/issues/2694
          if (!view.initialized || !view.staticBlocks.contentBlocks.length) {
            return
          }

          try {
            self.estimatedRegionStatsP = self.estimateRegionsStats(
              view.staticBlocks.contentBlocks,
              { signal: aborter.signal },
            )
            const estimatedRegionStats = await self.estimatedRegionStatsP

            if (isAlive(self)) {
              self.setRegionStats(estimatedRegionStats)
              superReload()
            } else {
              return
            }
          } catch (e) {
            console.error(e)
            self.setError(e)
          }
        },
        afterAttach() {
          // this autorun performs stats estimation
          //
          // the chain of events calls estimateRegionsStats against the data
          // adapter which by default uses featureDensity, but can also respond
          // with a byte size estimate and fetch size limit (data adapter can
          // define what is too much data)
          addDisposer(
            self,
            autorun(
              async () => {
                try {
                  const aborter = new AbortController()
                  const view = getContainingView(self) as LGV

                  // extra check for contentBlocks.length
                  // https://github.com/GMOD/jbrowse-components/issues/2694
                  if (
                    !view.initialized ||
                    !view.staticBlocks.contentBlocks.length
                  ) {
                    return
                  }

                  // don't re-estimate featureDensity even if zoom level changes,
                  // jbrowse1-style assume it's sort of representative
                  if (self.estimatedRegionStats?.featureDensity !== undefined) {
                    self.setCurrBpPerPx(view.bpPerPx)
                    return
                  }

                  // we estimate stats once at a given zoom level
                  if (view.bpPerPx === self.currBpPerPx) {
                    return
                  }

                  self.clearRegionStats()
                  self.setCurrBpPerPx(view.bpPerPx)
                  const statsP = self.estimateRegionsStats(
                    view.staticBlocks.contentBlocks,
                    { signal: aborter.signal },
                  )
                  self.setRegionStatsP(statsP)
                  const estimatedRegionStats = await statsP

                  if (isAlive(self)) {
                    self.setRegionStats(estimatedRegionStats)
                  }
                } catch (e) {
                  if (!isAbortException(e) && isAlive(self)) {
                    console.error(e)
                    self.setError(e)
                  }
                }
              },
              { delay: 500 },
            ),
          )
        },
      }
    })
    .views(self => ({
      /**
       * #method
       */
      regionCannotBeRenderedText(_region: Region) {
        return self.regionTooLarge ? 'Force load to see features' : ''
      },

      /**
       * #method
       * @param region -
       * @returns falsy if the region is fine to try rendering. Otherwise,
       *  return a react node + string of text.
       *  string of text describes why it cannot be rendered
       *  react node allows user to force load at current setting
       */
      regionCannotBeRendered(_region: Region) {
        const { regionTooLarge } = self
        return regionTooLarge ? <TooLargeMessage model={self} /> : null
      },

      /**
       * #method
       */
      trackMenuItems(): MenuItem[] {
        return []
      },

      /**
       * #method
       */
      contextMenuItems() {
        return self.contextMenuFeature
          ? [
              {
                label: 'Open feature details',
                icon: MenuOpenIcon,
                onClick: () => {
                  if (self.contextMenuFeature) {
                    self.selectFeature(self.contextMenuFeature)
                  }
                },
              },
            ]
          : []
      },
      /**
       * #method
       */
      renderProps() {
        const view = getContainingView(self) as LGV
        return {
          ...getParentRenderProps(self),
          notReady:
            self.currBpPerPx !== view.bpPerPx || !self.estimatedRegionStats,
          rpcDriverName: self.rpcDriverName,
          displayModel: self,
          onFeatureClick(_: unknown, featureId?: string) {
            const f = featureId || self.featureIdUnderMouse
            if (!f) {
              self.clearFeatureSelection()
            } else {
              const feature = self.features.get(f)
              if (feature) {
                self.selectFeature(feature)
              }
            }
          },
          onClick() {
            self.clearFeatureSelection()
          },
          // similar to click but opens a menu with further options
          onFeatureContextMenu(_: unknown, featureId?: string) {
            const f = featureId || self.featureIdUnderMouse
            if (!f) {
              self.clearFeatureSelection()
            } else {
              // feature id under mouse passed to context menu
              self.setContextMenuFeature(self.features.get(f))
            }
          },

          onMouseMove(_: unknown, featureId?: string) {
            self.setFeatureIdUnderMouse(featureId)
          },

          onMouseLeave(_: unknown) {
            self.setFeatureIdUnderMouse(undefined)
          },

          onContextMenu() {
            self.setContextMenuFeature(undefined)
            self.clearFeatureSelection()
          },
        }
      },
    }))
    .actions(self => ({
      /**
       * #method
       */
      async renderSvg(
        opts: ExportSvgOptions & {
          overrideHeight: number
          theme: ThemeOptions
        },
      ) {
        const { height, id } = self
        const { overrideHeight } = opts
        const view = getContainingView(self) as LGV
        const { offsetPx: viewOffsetPx, roundedDynamicBlocks, width } = view

        const renderings = await Promise.all(
          roundedDynamicBlocks.map(async block => {
            const blockState = BlockState.create({
              key: block.key,
              region: block,
            })

            // regionCannotBeRendered can return jsx so look for plaintext
            // version, or just get the default if none available
            const cannotBeRenderedReason =
              self.regionCannotBeRenderedText(block) ||
              self.regionCannotBeRendered(block)

            if (cannotBeRenderedReason) {
              return [
                block,
                {
                  reactElement: (
                    <>
                      <rect x={0} y={0} width={width} height={20} fill="#aaa" />
                      <text x={0} y={15}>
                        {cannotBeRenderedReason}
                      </text>
                    </>
                  ),
                },
              ] as const
            }

            const { rpcManager, renderArgs, renderProps, rendererType } =
              renderBlockData(blockState, self)

            return [
              block,
              await rendererType.renderInClient(rpcManager, {
                ...renderArgs,
                ...renderProps,
                viewParams: getViewParams(self, true),
                exportSVG: opts,
                theme: opts.theme || renderProps.theme,
              }),
            ] as const
          }),
        )

        return (
          <>
            {renderings.map(([block, rendering], index) => {
              const { offsetPx, widthPx } = block
              const offset = offsetPx - viewOffsetPx
              const clipid = getId(id, index)

              return (
                <React.Fragment key={`frag-${index}`}>
                  <defs>
                    <clipPath id={clipid}>
                      <rect
                        x={0}
                        y={0}
                        width={widthPx}
                        height={overrideHeight || height}
                      />
                    </clipPath>
                  </defs>
                  <g transform={`translate(${offset} 0)`}>
                    <g clipPath={`url(#${clipid})`}>
                      <ReactRendering rendering={rendering} />
                    </g>
                  </g>
                </React.Fragment>
              )
            })}
          </>
        )
      },
    }))
    .preProcessSnapshot(snap => {
      if (!snap) {
        return snap
      }
      // rewrite "height" from older snapshots to "heightPreConfig", this allows
      // us to maintain a height "getter" going forward
      // @ts-expect-error
      const { height, ...rest } = snap
      return { heightPreConfig: height, ...rest }
    })
    .postProcessSnapshot(self => {
      // xref https://github.com/mobxjs/mobx-state-tree/issues/1524 for Omit
      const r = self as Omit<typeof self, symbol>
      const { blockState, ...rest } = r
      return rest
    })
}

export const BaseLinearDisplay = stateModelFactory()

export type BaseLinearDisplayStateModel = typeof BaseLinearDisplay
export type BaseLinearDisplayModel = Instance<BaseLinearDisplayStateModel>

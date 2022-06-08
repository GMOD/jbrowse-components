/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Button, Typography } from '@material-ui/core'
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
} from '@jbrowse/core/util'
import { Stats } from '@jbrowse/core/data_adapters/BaseAdapter'
import { BaseBlock } from '@jbrowse/core/util/blockTypes'
import { Region } from '@jbrowse/core/util/types'
import CompositeMap from '@jbrowse/core/util/compositeMap'
import { Feature, isFeature } from '@jbrowse/core/util/simpleFeature'
import {
  getParentRenderProps,
  getRpcSessionId,
} from '@jbrowse/core/util/tracks'
import { autorun } from 'mobx'
import { addDisposer, isAlive, types, Instance } from 'mobx-state-tree'
// icons
import MenuOpenIcon from '@material-ui/icons/MenuOpen'

import { LinearGenomeViewModel, ExportSvgOptions } from '../../LinearGenomeView'
import { Tooltip } from '../components/BaseLinearDisplay'
import BlockState, { renderBlockData } from './serverSideRenderedBlock'

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
    displayBp = `${parseFloat((totalBytes / 1000000).toPrecision(3))} Mb`
  } else if (Math.floor(totalBytes / 1000) > 0) {
    displayBp = `${parseFloat((totalBytes / 1000).toPrecision(3))} Kb`
  } else {
    displayBp = `${Math.floor(totalBytes)} bytes`
  }
  return displayBp
}

const minDisplayHeight = 20
const defaultDisplayHeight = 100

export const BaseLinearDisplay = types
  .compose(
    'BaseLinearDisplay',
    BaseDisplay,
    types.model({
      height: types.optional(
        types.refinement(
          'displayHeight',
          types.number,
          n => n >= minDisplayHeight,
        ),
        defaultDisplayHeight,
      ),
      blockState: types.map(BlockState),
      userBpPerPxLimit: types.maybe(types.number),
      userByteSizeLimit: types.maybe(types.number),
    }),
  )
  .volatile(() => ({
    currBpPerPx: 0,
    message: '',
    featureIdUnderMouse: undefined as undefined | string,
    contextMenuFeature: undefined as undefined | Feature,
    scrollTop: 0,
    estimatedRegionStatsP: undefined as undefined | Promise<Stats>,
    estimatedRegionStats: undefined as undefined | Stats,
  }))
  .views(self => ({
    get blockType(): 'staticBlocks' | 'dynamicBlocks' {
      return 'staticBlocks'
    },
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
     * how many milliseconds to wait for the display to
     * "settle" before re-rendering a block
     */
    get renderDelay() {
      return 50
    },

    get TooltipComponent(): React.FC<any> {
      return Tooltip as unknown as React.FC
    },

    /**
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
     * if a display-level message should be displayed instead of the blocks,
     * make this return a react component
     */
    get DisplayMessageComponent() {
      return undefined as undefined | React.FC<any>
    },
  }))
  .views(self => ({
    /**
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

    get featureUnderMouse() {
      const feat = self.featureIdUnderMouse
      return feat ? this.features.get(feat) : undefined
    },

    getFeatureOverlapping(blockKey: string, x: number, y: number) {
      return self.blockState.get(blockKey)?.layout?.getByCoord(x, y)
    },

    getFeatureByID(blockKey: string, id: string): LayoutRecord | undefined {
      return self.blockState.get(blockKey)?.layout?.getByID(id)
    },

    // if block key is not supplied, can look at all blocks
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

    get currentBytesRequested() {
      return self.estimatedRegionStats?.bytes || 0
    },

    get currentFeatureScreenDensity() {
      const view = getContainingView(self) as LGV
      return (self.estimatedRegionStats?.featureDensity || 0) * view.bpPerPx
    },

    get maxFeatureScreenDensity() {
      return getConf(self, 'maxFeatureScreenDensity')
    },
    get estimatedStatsReady() {
      return !!self.estimatedRegionStats
    },

    get maxAllowableBytes() {
      return (
        self.userByteSizeLimit ||
        self.estimatedRegionStats?.fetchSizeLimit ||
        (getConf(self, 'fetchSizeLimit') as number)
      )
    },
  }))
  .actions(self => ({
    // base display reload does nothing, see specialized displays for details
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
    setRegionStatsP(p?: Promise<Stats>) {
      self.estimatedRegionStatsP = p
    },
    setRegionStats(estimatedRegionStats?: Stats) {
      self.estimatedRegionStats = estimatedRegionStats
    },
    clearRegionStats() {
      self.estimatedRegionStatsP = undefined
      self.estimatedRegionStats = undefined
    },
    setHeight(displayHeight: number) {
      if (displayHeight > minDisplayHeight) {
        self.height = displayHeight
      } else {
        self.height = minDisplayHeight
      }
      return self.height
    },
    resizeHeight(distance: number) {
      const oldHeight = self.height
      const newHeight = this.setHeight(self.height + distance)
      return newHeight - oldHeight
    },

    setScrollTop(scrollTop: number) {
      self.scrollTop = scrollTop
    },

    updateStatsLimit(stats: Stats) {
      const view = getContainingView(self) as LGV
      if (stats.bytes) {
        self.userByteSizeLimit = stats.bytes
      } else {
        self.userBpPerPxLimit = view.bpPerPx
      }
    },

    addBlock(key: string, block: BaseBlock) {
      self.blockState.set(
        key,
        BlockState.create({
          key,
          region: block.toRegion(),
        }),
      )
    },
    setCurrBpPerPx(n: number) {
      self.currBpPerPx = n
    },
    deleteBlock(key: string) {
      self.blockState.delete(key)
    },
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
    clearFeatureSelection() {
      const session = getSession(self)
      session.clearSelection()
    },
    setFeatureIdUnderMouse(feature: string | undefined) {
      self.featureIdUnderMouse = feature
    },
    reload() {
      ;[...self.blockState.values()].map(val => val.doReload())
    },
    setContextMenuFeature(feature?: Feature) {
      self.contextMenuFeature = feature
    },
  }))
  .views(self => ({
    // region is too large if:
    // - stats are ready
    // - region is greater than 20kb (don't warn when zoomed in less than that)
    // - and bytes > max allowed bytes || curr density>max density
    get regionTooLarge() {
      const view = getContainingView(self) as LGV
      if (!self.estimatedStatsReady || view.dynamicBlocks.totalBp < 20_000) {
        return false
      }
      const bpLimitOrDensity = self.userBpPerPxLimit
        ? view.bpPerPx > self.userBpPerPxLimit
        : self.currentFeatureScreenDensity > self.maxFeatureScreenDensity

      return (
        self.currentBytesRequested > self.maxAllowableBytes || bpLimitOrDensity
      )
    },

    // only shows a message of bytes requested is defined, the feature density
    // based stats don't produce any helpful message besides to zoom in
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
    regionCannotBeRenderedText(_region: Region) {
      return self.regionTooLarge ? 'Force load to see features' : ''
    },

    /**
     * @param region -
     * @returns falsy if the region is fine to try rendering. Otherwise,
     *  return a react node + string of text.
     *  string of text describes why it cannot be rendered
     *  react node allows user to force load at current setting
     */
    regionCannotBeRendered(_region: Region) {
      const { regionTooLarge, regionTooLargeReason } = self

      if (regionTooLarge) {
        return (
          <>
            <Typography component="span" variant="body2">
              {regionTooLargeReason ? regionTooLargeReason + '. ' : ''}
              Zoom in to see features or{' '}
            </Typography>
            <Button
              data-testid="force_reload_button"
              onClick={() => {
                if (!self.estimatedRegionStats) {
                  console.error('No global stats?')
                } else {
                  self.updateStatsLimit(self.estimatedRegionStats)
                  self.reload()
                }
              }}
              variant="outlined"
            >
              Force Load
            </Button>
            <Typography component="span" variant="body2">
              (force load may be slow)
            </Typography>
          </>
        )
      }
      return undefined
    },

    trackMenuItems(): MenuItem[] {
      return []
    },

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
    renderProps() {
      const view = getContainingView(self) as LGV
      return {
        ...getParentRenderProps(self),
        notReady:
          self.currBpPerPx !== view.bpPerPx || !self.estimatedRegionStats,
        rpcDriverName: self.rpcDriverName,
        displayModel: self,
        onFeatureClick(_: unknown, featureId: string | undefined) {
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
        onFeatureContextMenu(_: unknown, featureId: string | undefined) {
          const f = featureId || self.featureIdUnderMouse
          if (!f) {
            self.clearFeatureSelection()
          } else {
            // feature id under mouse passed to context menu
            self.setContextMenuFeature(self.features.get(f))
          }
        },

        onMouseMove(_: unknown, featureId: string | undefined) {
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
    async renderSvg(opts: ExportSvgOptions & { overrideHeight: number }) {
      const { height, id } = self
      const { overrideHeight } = opts
      const view = getContainingView(self) as LGV
      const { offsetPx: viewOffsetPx, roundedDynamicBlocks, width } = view

      const renderings = await Promise.all(
        roundedDynamicBlocks.map(block => {
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
            return {
              reactElement: (
                <>
                  <rect x={0} y={0} width={width} height={20} fill="#aaa" />
                  <text x={0} y={15}>
                    {cannotBeRenderedReason}
                  </text>
                </>
              ),
            }
          }

          const { rpcManager, renderArgs, renderProps, rendererType } =
            renderBlockData(blockState, self)

          return rendererType.renderInClient(rpcManager, {
            ...renderArgs,
            ...renderProps,
            viewParams: getViewParams(self, true),
            exportSVG: opts,
          })
        }),
      )

      return (
        <>
          {renderings.map((rendering, index) => {
            const { offsetPx } = roundedDynamicBlocks[index]
            const offset = offsetPx - viewOffsetPx
            const clipid = getId(id, index)

            return (
              <React.Fragment key={`frag-${index}`}>
                <defs>
                  <clipPath id={clipid}>
                    <rect
                      x={0}
                      y={0}
                      width={width}
                      height={overrideHeight || height}
                    />
                  </clipPath>
                </defs>
                <g transform={`translate(${offset} 0)`}>
                  <g clipPath={`url(#${clipid})`}>
                    {React.isValidElement(rendering.reactElement) ? (
                      rendering.reactElement
                    ) : (
                      // eslint-disable-next-line react/no-danger
                      <g dangerouslySetInnerHTML={{ __html: rendering.html }} />
                    )}
                  </g>
                </g>
              </React.Fragment>
            )
          })}
        </>
      )
    },
  }))
  .postProcessSnapshot(self => {
    const { blockState, ...rest } = self
    return rest
  })

export type BaseLinearDisplayStateModel = typeof BaseLinearDisplay
export type BaseLinearDisplayModel = Instance<BaseLinearDisplayStateModel>

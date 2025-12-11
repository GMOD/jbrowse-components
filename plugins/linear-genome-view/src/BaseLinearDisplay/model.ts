import type React from 'react'
import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isFeature,
  isSelectionContainer,
  isSessionModelWithWidgets,
  mergeIntervals,
} from '@jbrowse/core/util'
import CompositeMap from '@jbrowse/core/util/compositeMap'
import {
  getParentRenderProps,
  getRpcSessionId,
} from '@jbrowse/core/util/tracks'
import {
  addDisposer,
  getSnapshot,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import { autorun, when } from 'mobx'

import FeatureDensityMixin from './models/FeatureDensityMixin'
import TrackHeightMixin from './models/TrackHeightMixin'
import configSchema from './models/configSchema'
import BlockState from './models/serverSideRenderedBlock'

import type { LinearGenomeViewModel } from '../LinearGenomeView'
import type { ExportSvgOptions } from '../LinearGenomeView/types'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AnyReactComponentType, Feature } from '@jbrowse/core/util'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ThemeOptions } from '@mui/material'

// lazies
const Tooltip = lazy(() => import('./components/Tooltip'))
const SelectTranscriptDialog = lazy(
  () => import('./components/SelectTranscriptDialog'),
)

type LGV = LinearGenomeViewModel

export interface Layout {
  minX: number
  minY: number
  maxX: number
  maxY: number
  name: string
}

export interface FloatingLabelData {
  text: string
  relativeY: number
  color: string
  isOverlay?: boolean
}

export type LayoutRecord =
  | [number, number, number, number]
  | [
      number,
      number,
      number,
      number,
      {
        label?: string
        description?: string
        refName: string
        floatingLabels?: FloatingLabelData[]
        totalFeatureHeight?: number
        totalLayoutWidth?: number
        featureWidth?: number
        actualTopPx?: number
      },
    ]

export interface ExportSvgDisplayOptions extends ExportSvgOptions {
  overrideHeight?: number
  theme?: ThemeOptions
}

/**
 * #stateModel BaseLinearDisplay
 * #category display
 *
 * BaseLinearDisplay is used as the basis for many linear genome view tracks.
 * It is block based, and can use 'static blocks' or 'dynamic blocks'
 *
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 * - [FeatureDensityMixin](../featuredensitymixin)
 */
function stateModelFactory() {
  return types
    .compose(
      'BaseLinearDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      FeatureDensityMixin(),
      types.model({
        /**
         * #property
         * updated via autorun
         */
        blockState: types.map(BlockState),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      mouseoverExtraInformation: undefined as string | undefined,
      /**
       * #volatile
       */
      featureIdUnderMouse: undefined as undefined | string,
      /**
       * #volatile
       */
      contextMenuFeature: undefined as undefined | Feature,
    }))
    .views(self => ({
      /**
       * #getter
       * if a display-level message should be displayed instead of the blocks,
       * make this return a react component
       */
      get DisplayMessageComponent(): undefined | React.FC<any> {
        return undefined
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
        const view = getContainingView(self) as LGV
        if (!view.initialized) {
          throw new Error('view not initialized yet')
        }
        return view[this.blockType]
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
      get TooltipComponent(): AnyReactComponentType {
        return Tooltip as AnyReactComponentType
      },

      /**
       * #getter
       * returns a string feature ID if the globally-selected object
       * is probably a feature
       */
      get selectedFeatureId() {
        if (isAlive(self)) {
          const { selection } = getSession(self)
          if (isFeature(selection)) {
            return selection.id()
          }
        }
        return undefined
      },
      /**
       * #method
       */
      async copyInfoToClipboard(feature: Feature) {
        const { uniqueId, ...rest } = feature.toJSON()
        const session = getSession(self)
        const { default: copy } = await import('copy-to-clipboard')
        copy(JSON.stringify(rest, null, 4))
        session.notify('Copied to clipboard', 'success')
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
          if (block.features) {
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
      get layoutFeatures() {
        const featureMaps = []
        for (const block of self.blockState.values()) {
          if (block.layout?.getRectangles) {
            // Use getRectangles() to get consistent tuple format [left, top, right, bottom, data]
            // This works for both GranularRectLayout (raw) and PrecomputedLayout (serialized)
            featureMaps.push(block.layout.getRectangles())
          }
        }
        return new CompositeMap<string, LayoutRecord>(featureMaps)
      },

      /**
       * #getter
       */
      getFeatureOverlapping(
        blockKey: string,
        x: number,
        y: number,
      ): string | undefined {
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
        let ret: LayoutRecord | undefined
        for (const block of self.blockState.values()) {
          const val = block.layout?.getByID(id)
          if (val) {
            ret = val
          }
        }
        return ret
      },
    }))

    .actions(self => ({
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
      deleteBlock(key: string) {
        self.blockState.delete(key)
      },
      /**
       * #action
       */
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const { rpcManager } = session
          const sessionId = getRpcSessionId(self)
          const track = getContainingTrack(self)
          const view = getContainingView(self)
          const adapterConfig = getConf(track, 'adapter')

          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            try {
              const descriptions = await rpcManager.call(
                sessionId,
                'CoreGetMetadata',
                {
                  adapterConfig,
                },
              )
              session.showWidget(
                session.addWidget('BaseFeatureWidget', 'baseFeature', {
                  featureData: feature.toJSON(),
                  view,
                  track,
                  descriptions,
                }),
              )
            } catch (e) {
              console.error(e)
              getSession(e).notifyError(`${e}`, e)
            }
          })()
        }

        if (isSelectionContainer(session)) {
          session.setSelection(feature)
        }
      },

      /**
       * #action
       */
      navToFeature(feature: Feature) {
        const view = getContainingView(self) as LGV
        view.navTo({
          refName: feature.get('refName'),
          start: feature.get('start'),
          end: feature.get('end'),
        })
      },
      /**
       * #action
       */
      clearFeatureSelection() {
        getSession(self).clearSelection()
      },
      /**
       * #action
       */
      setFeatureIdUnderMouse(feature?: string) {
        self.featureIdUnderMouse = feature
      },

      /**
       * #action
       */
      setContextMenuFeature(feature?: Feature) {
        self.contextMenuFeature = feature
      },
      /**
       * #action
       */
      setMouseoverExtraInformation(extra?: string) {
        self.mouseoverExtraInformation = extra
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
          self.setCurrStatsBpPerPx(0)
          self.clearFeatureDensityStats()
          for (const val of self.blockState.values()) {
            val.doReload()
          }
          superReload()
        },
      }
    })

    .views(self => ({
      /**
       * #method
       */
      trackMenuItems(): MenuItem[] {
        return []
      },

      /**
       * #method
       */
      contextMenuItems(): MenuItem[] {
        const feat = self.contextMenuFeature
        const { contextMenuFeature } = self
        const transcripts: Feature[] =
          contextMenuFeature?.get('type') === 'mRNA'
            ? [contextMenuFeature]
            : (contextMenuFeature?.get('subfeatures') ?? [])

        const hasTranscriptsWithExons = transcripts.some(t => {
          const subs = t.get('subfeatures') ?? []
          return subs.some(
            f => f.get('type') === 'exon' || f.get('type') === 'CDS',
          )
        })

        const collapseIntrons = async (transcript: Feature) => {
          const view = getContainingView(self) as LGV
          const { assemblyManager } = getSession(self)
          const assemblyName = view.assemblyNames[0]
          const assembly = assemblyName
            ? assemblyManager.get(assemblyName)
            : undefined
          const r0 = transcript.get('refName')
          const refName = assembly?.getCanonicalRefName(r0) || r0
          const w = 100

          const subs =
            transcript
              .get('subfeatures')
              ?.filter(
                f => f.get('type') === 'exon' || f.get('type') === 'CDS',
              ) ?? []

          // need to strip ID before copying view snap
          const { id, ...rest } = getSnapshot(view)
          const newView = getSession(self).addView('LinearGenomeView', {
            ...rest,
            tracks: rest.tracks.map(track => {
              const { id, ...rest } = track
              return { ...rest }
            }),
            displayedRegions: mergeIntervals(
              subs.map(f => ({
                refName,
                start: f.get('start') - w,
                end: f.get('end') + w,
                assemblyName: view.assemblyNames[0],
              })),
              w,
            ),
          }) as LGV
          await when(() => newView.initialized)

          newView.showAllRegions()
        }

        return feat
          ? [
              {
                label: 'Open feature details',
                icon: MenuOpenIcon,
                onClick: () => {
                  self.selectFeature(feat)
                },
              },
              {
                label: 'Zoom to feature',
                icon: CenterFocusStrongIcon,
                onClick: () => {
                  self.navToFeature(feat)
                },
              },
              {
                label: 'Copy info to clipboard',
                icon: ContentCopyIcon,
                onClick: () => {
                  // eslint-disable-next-line @typescript-eslint/no-floating-promises
                  self.copyInfoToClipboard(feat)
                },
              },
              ...(hasTranscriptsWithExons
                ? [
                    {
                      label: 'Collapse introns',
                      onClick: () => {
                        if (transcripts.length > 1) {
                          getSession(self).queueDialog(handleClose => [
                            SelectTranscriptDialog,
                            {
                              transcripts,
                              handleClose,
                              onSelect: (transcript: Feature) => {
                                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                                collapseIntrons(transcript)
                              },
                            },
                          ])
                        } else {
                          // eslint-disable-next-line @typescript-eslint/no-floating-promises
                          collapseIntrons(transcripts[0]!)
                        }
                      },
                    },
                  ]
                : []),
            ]
          : []
      },
      /**
       * #method
       * props for the renderer's React "Rendering" component - client-side
       * only, never sent to the worker. includes displayModel and callbacks
       */
      renderingProps() {
        return {
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
          // similar to click but opens a menu with further
          // options
          onFeatureContextMenu(_: unknown, featureId?: string) {
            const f = featureId || self.featureIdUnderMouse
            if (!f) {
              self.clearFeatureSelection()
            } else {
              // feature id under mouse passed to context menu
              self.setContextMenuFeature(self.features.get(f))
            }
          },

          onMouseMove(_: unknown, featureId?: string, extra?: string) {
            self.setFeatureIdUnderMouse(featureId)
            self.setMouseoverExtraInformation(extra)
          },

          onMouseLeave(_: unknown) {
            self.setFeatureIdUnderMouse(undefined)
            self.setMouseoverExtraInformation(undefined)
          },

          onContextMenu(_: unknown) {
            self.setContextMenuFeature(undefined)
            self.clearFeatureSelection()
          },
        }
      },
      /**
       * #method
       * props sent to the worker for server-side rendering
       */
      renderProps() {
        return {
          ...getParentRenderProps(self),
          notReady: !self.featureDensityStatsReady,
          rpcDriverName: self.effectiveRpcDriverName,
        }
      },
    }))
    .actions(self => ({
      /**
       * #method
       */
      async renderSvg(opts: ExportSvgDisplayOptions) {
        const { renderBaseLinearDisplaySvg } = await import('./renderSvg')
        return renderBaseLinearDisplaySvg(self as BaseLinearDisplayModel, opts)
      },
      afterAttach() {
        // watch the parent's blocks to update our block state when they
        // change, then we recreate the blocks on our own model (creating and
        // deleting to match the parent blocks)
        addDisposer(
          self,
          autorun(
            function blockDefinitionsAutorun() {
              try {
                if (!isAlive(self)) {
                  return
                }
                const blocksPresent: Record<string, boolean> = {}
                const view = getContainingView(self) as LGV
                if (!view.initialized) {
                  return
                }
                for (const block of self.blockDefinitions.contentBlocks) {
                  blocksPresent[block.key] = true
                  if (!self.blockState.has(block.key)) {
                    self.addBlock(block.key, block)
                  }
                }
                for (const key of self.blockState.keys()) {
                  if (!blocksPresent[key]) {
                    self.deleteBlock(key)
                  }
                }
              } catch (e) {
                // catch errors that may occur during test cleanup or when
                // the display is not properly attached to a view
              }
            },
            { name: 'BaseLinearDisplayBlockDefinitions' },
          ),
        )
      },
    }))
    .preProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      // rewrite "height" from older snapshots to "heightPreConfig", this allows
      // us to maintain a height "getter" going forward
      // @ts-expect-error
      const { height, ...rest } = snap
      return { heightPreConfig: height, ...rest }
    })
    .postProcessSnapshot(snap => {
      // xref for Omit https://github.com/mobxjs/mobx-state-tree/issues/1524
      const r = snap as Omit<typeof snap, symbol>
      const { blockState, ...rest } = r
      return rest
    })
}

export const BaseLinearDisplay = stateModelFactory()

export type BaseLinearDisplayStateModel = typeof BaseLinearDisplay
export type BaseLinearDisplayModel = Instance<BaseLinearDisplayStateModel>

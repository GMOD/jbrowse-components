import React, { lazy } from 'react'
import {
  types,
  getParent,
  onAction,
  addDisposer,
  getPath,
  Instance,
} from 'mobx-state-tree'
import { autorun } from 'mobx'
import { saveAs } from 'file-saver'

// jbrowse
import {
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
} from '@jbrowse/plugin-linear-genome-view'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession, Feature, notEmpty } from '@jbrowse/core/util'
import { AnyConfigurationModel, getConf } from '@jbrowse/core/configuration'

// icons
import PhotoCamera from '@mui/icons-material/PhotoCamera'
import LinkIcon from '@mui/icons-material/Link'

// locals
import { intersect } from './util'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog'))

interface Display {
  searchFeatureByID?: (str: string) => LayoutRecord
}

interface Track {
  displays: Display[]
}

function calc(track: Track, f: Feature) {
  return track.displays[0].searchFeatureByID?.(f.id())
}

export interface ExportSvgOptions {
  rasterizeLayers?: boolean
  filename?: string
  Wrapper?: React.FC<{ children: React.ReactNode }>
  fontSize?: number
  rulerHeight?: number
  textHeight?: number
  paddingHeight?: number
  headerHeight?: number
  cytobandHeight?: number
  trackLabels?: string
  themeName?: string
}

type LGV = LinearGenomeViewModel

export interface Breakend {
  MateDirection: string
  Join: string
  Replacement: string
  MatePosition: string
}

export type LayoutRecord = [number, number, number, number]

async function getBlockFeatures(
  model: BreakpointViewModel,
  track: { configuration: AnyConfigurationModel },
) {
  const { views } = model
  const { rpcManager, assemblyManager } = getSession(model)
  const assemblyName = model.views[0].assemblyNames[0]
  const assembly = await assemblyManager.waitForAssembly(assemblyName)
  if (!assembly) {
    return undefined // throw new Error(`assembly not found: "${assemblyName}"`)
  }
  const sessionId = track.configuration.trackId
  return Promise.all(
    views.map(async view =>
      (
        (await rpcManager.call(sessionId, 'CoreGetFeatures', {
          adapterConfig: getConf(track, ['adapter']),
          sessionId,
          regions: view.staticBlocks.contentBlocks,
        })) as Feature[][]
      ).flat(),
    ),
  )
}

/**
 * #stateModel BreakpointSplitView
 * extends
 * - [BaseViewModel](../baseviewmodel)
 */
export default function stateModelFactory(pluginManager: PluginManager) {
  const minHeight = 40
  const defaultHeight = 400
  return types
    .compose(
      'BreakpointSplitView',
      BaseViewModel,
      types.model({
        /**
         * #property
         */
        type: types.literal('BreakpointSplitView'),
        /**
         * #property
         */
        height: types.optional(
          types.refinement(
            'viewHeight',
            types.number,
            (n: number) => n >= minHeight,
          ),
          defaultHeight,
        ),
        /**
         * #property
         */
        trackSelectorType: 'hierarchical',
        /**
         * #property
         */
        showIntraviewLinks: true,
        /**
         * #property
         */
        linkViews: false,
        /**
         * #property
         */
        interactToggled: false,
        /**
         * #property
         */
        views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        ),
      }),
    )
    .volatile(() => ({
      width: 800,
      matchedTrackFeatures: {} as Record<string, Feature[][]>,
    }))
    .views(self => ({
      /**
       * #method
       * creates an svg export and save using FileSaver
       */
      async exportSvg(opts: ExportSvgOptions = {}) {
        const { renderToSvg } = await import(
          './svgcomponents/SVGBreakpointSplitView'
        )
        const html = await renderToSvg(self as BreakpointViewModel, opts)
        const blob = new Blob([html], { type: 'image/svg+xml' })
        saveAs(blob, opts.filename || 'image.svg')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Find all track ids that match across multiple views
       */
      get matchedTracks() {
        return intersect(
          elt => elt.configuration.trackId as string,
          ...self.views.map(view => view.tracks),
        )
      },

      /**
       * #method
       * Get tracks with a given trackId across multiple views
       */
      getMatchedTracks(trackConfigId: string) {
        return self.views
          .map(view => view.getTrack(trackConfigId))
          .filter(f => !!f)
      },

      /**
       * #method
       *
       * Translocation features are handled differently
       * since they do not have a mate e.g. they are one sided
       */
      hasTranslocations(trackConfigId: string) {
        return [...this.getTrackFeatures(trackConfigId).values()].find(
          f => f.get('type') === 'translocation',
        )
      },

      /**
       * #method
       * Get a composite map of featureId-\>feature map for a track across
       * multiple views
       */
      getTrackFeatures(trackConfigId: string) {
        return new Map(
          self.matchedTrackFeatures[trackConfigId]
            ?.flat()
            .map(f => [f.id(), f]),
        )
      },

      /**
       * #method
       */
      getMatchedFeaturesInLayout(trackConfigId: string, features: Feature[][]) {
        // use reverse to search the second track first
        const tracks = this.getMatchedTracks(trackConfigId)

        return features.map(c =>
          c
            .map(feature => {
              const level = tracks.findIndex(track => calc(track, feature))
              return level !== -1
                ? {
                    feature,
                    layout: calc(tracks[level], feature),
                    level,
                  }
                : undefined
            })
            .filter(notEmpty),
        )
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          onAction(
            self,
            ({
              name,
              path,
              args,
            }: {
              name: string
              path?: string
              args?: unknown[]
            }) => {
              if (self.linkViews) {
                const actions = [
                  'horizontalScroll',
                  'zoomTo',
                  'setScaleFactor',
                  'showTrack',
                  'toggleTrack',
                  'hideTrack',
                  'setTrackLabels',
                  'toggleCenterLine',
                ]
                if (actions.includes(name) && path) {
                  this.onSubviewAction(name, path, args)
                }
              }
            },
          ),
        )
      },

      onSubviewAction(actionName: string, path: string, args?: unknown[]) {
        self.views.forEach(view => {
          const ret = getPath(view)
          if (!ret.endsWith(path)) {
            // @ts-ignore
            view[actionName](args?.[0])
          }
        })
      },

      /**
       * #action
       */
      setWidth(newWidth: number) {
        self.width = newWidth
        self.views.forEach(v => v.setWidth(newWidth))
      },

      /**
       * #action
       */
      removeView(view: LGV) {
        self.views.remove(view)
      },

      /**
       * #action
       */
      closeView() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getParent<any>(self, 2).removeView(self)
      },

      /**
       * #action
       */
      toggleInteract() {
        self.interactToggled = !self.interactToggled
      },

      /**
       * #action
       */
      toggleIntraviewLinks() {
        self.showIntraviewLinks = !self.showIntraviewLinks
      },

      /**
       * #action
       */
      toggleLinkViews() {
        self.linkViews = !self.linkViews
      },

      /**
       * #action
       */
      setMatchedTrackFeatures(obj: Record<string, Feature[][]>) {
        self.matchedTrackFeatures = obj
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(async () => {
            try {
              if (!self.views.every(view => view.initialized)) {
                return
              }
              self.setMatchedTrackFeatures(
                Object.fromEntries(
                  await Promise.all(
                    self.matchedTracks.map(async track => [
                      track.configuration.trackId,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      await getBlockFeatures(self as any, track),
                    ]),
                  ),
                ),
              )
            } catch (e) {
              console.error(e)
              getSession(self).notify(`${e}`, 'error')
            }
          }),
        )
      },

      /**
       * #method
       */
      menuItems() {
        return [
          ...self.views
            .map((view, idx) => [idx, view.menuItems?.()] as const)
            .filter(f => !!f[1])
            .map(f => ({ label: `View ${f[0] + 1} Menu`, subMenu: f[1] })),

          {
            label: 'Show intra-view links',
            type: 'checkbox',
            checked: self.showIntraviewLinks,
            onClick: () => self.toggleIntraviewLinks(),
          },
          {
            label: 'Allow clicking alignment squiggles?',
            type: 'checkbox',
            checked: self.interactToggled,
            onClick: () => self.toggleInteract(),
          },

          {
            label: 'Link views',
            type: 'checkbox',
            icon: LinkIcon,
            checked: self.linkViews,
            onClick: () => {
              self.toggleLinkViews()
            },
          },
          {
            label: 'Export SVG',
            icon: PhotoCamera,
            onClick: (): void => {
              getSession(self).queueDialog(handleClose => [
                ExportSvgDialog,
                { model: self, handleClose },
              ])
            },
          },
        ]
      },
    }))
}

export type BreakpointViewStateModel = ReturnType<typeof stateModelFactory>
export type BreakpointViewModel = Instance<BreakpointViewStateModel>

import { lazy } from 'react'

import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession, notEmpty } from '@jbrowse/core/util'
import {
  addDisposer,
  addMiddleware,
  cast,
  getPath,
  types,
} from '@jbrowse/mobx-state-tree'
import LinkIcon from '@mui/icons-material/Link'
import PhotoCamera from '@mui/icons-material/PhotoCamera'
import { autorun } from 'mobx'

import { getClip } from './getClip'
import { calc, getBlockFeatures, intersect } from './util'

import type { BreakpointSplitViewInit, ExportSvgOptions } from './types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog'))

/**
 * #stateModel BreakpointSplitView
 * extends
 * - [BaseViewModel](../baseviewmodel)
 */
export default function stateModelFactory(pluginManager: PluginManager) {
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
        height: types.optional(types.number, defaultHeight),
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
        interactiveOverlay: true,
        /**
         * #property
         */
        showHeader: false,
        /**
         * #property
         */
        views: types.array(
          pluginManager.getViewType('LinearGenomeView')!
            .stateModel as LinearGenomeViewStateModel,
        ),
        /**
         * #property
         * used for initializing the view from a session snapshot
         */
        init: types.frozen<BreakpointSplitViewInit | undefined>(),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      width: 800,
      /**
       * #volatile
       */
      matchedTrackFeatures: {} as Record<string, Feature[][]>,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get hasSomethingToShow() {
        return self.views.length > 0 || !!self.init
      },

      /**
       * #getter
       */
      get initialized() {
        return self.views.length > 0 && self.views.every(v => v.initialized)
      },

      /**
       * #getter
       */
      get showImportForm() {
        return !this.hasSomethingToShow
      },
    }))
    .views(self => ({
      /**
       * #method
       * creates an svg export and save using FileSaver
       */
      async exportSvg(opts: ExportSvgOptions = {}) {
        const { renderToSvg } =
          await import('./svgcomponents/SVGBreakpointSplitView')
        const html = await renderToSvg(self as BreakpointViewModel, opts)
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const { saveAs } = await import('file-saver-es')

        saveAs(
          new Blob([html], { type: 'image/svg+xml' }),
          opts.filename || 'image.svg',
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Find all track ids that match across multiple views, or return just
       * the single view's track if only a single row is used
       */
      get matchedTracks() {
        return self.views.length === 1
          ? self.views[0]!.tracks
          : intersect(
              elt => elt.configuration.trackId,
              ...self.views.map(
                view => view.tracks as { configuration: { trackId: string } }[],
              ),
            )
      },

      /**
       * #method
       * Get tracks with a given trackId across multiple views
       */
      getMatchedTracks(trackConfigId: string) {
        return self.views
          .map(view => view.getTrack(trackConfigId))
          .filter(notEmpty)
      },

      /**
       * #method
       * Translocation features are handled differently since they do not have
       * a mate e.g. they are one sided
       */
      hasTranslocations(trackConfigId: string) {
        return [...this.getTrackFeatures(trackConfigId).values()].some(
          f => f.get('type') === 'translocation',
        )
      },

      /**
       * #method
       * Paired features similar to breakends, but simpler, like BEDPE
       */
      hasPairedFeatures(trackConfigId: string) {
        return [...this.getTrackFeatures(trackConfigId).values()].some(
          f => f.get('type') === 'paired_feature',
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
            .map(f => [f.id(), f] as const),
        )
      },

      /**
       * #method
       */
      getMatchedFeaturesInLayout(trackConfigId: string, features: Feature[][]) {
        const tracks = this.getMatchedTracks(trackConfigId)
        return features.map(c =>
          c
            .map(feature => {
              for (let level = 0; level < tracks.length; level++) {
                const layout = calc(tracks[level], feature)
                if (layout) {
                  const cigar = feature.get('CIGAR')
                  const strand = feature.get('strand')
                  return {
                    feature,
                    layout,
                    level,
                    clipLengthAtStartOfRead: getClip(cigar, strand),
                  }
                }
              }
              return undefined
            })
            .filter(notEmpty),
        )
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          addMiddleware(self, (rawCall, next) => {
            if (rawCall.type === 'action' && rawCall.id === rawCall.rootId) {
              const syncActions = [
                'horizontalScroll',
                'zoomTo',
                'setScaleFactor',
                'showTrack',
                'toggleTrack',
                'hideTrack',
                'setTrackLabels',
                'toggleCenterLine',
              ]

              if (self.linkViews && syncActions.includes(rawCall.name)) {
                const sourcePath = getPath(rawCall.context)
                const result = next(rawCall)
                // Sync to all other views
                for (const view of self.views) {
                  const viewPath = getPath(view)
                  if (viewPath !== sourcePath) {
                    // @ts-expect-error
                    view[rawCall.name](rawCall.args[0])
                  }
                }
                return result
              }
            }
            return next(rawCall)
          }),
        )
      },

      onSubviewAction(actionName: string, path: string, args?: unknown[]) {
        for (const view of self.views) {
          const ret = getPath(view)
          if (!ret.endsWith(path)) {
            // @ts-expect-error
            view[actionName](args?.[0])
          }
        }
      },

      /**
       * #action
       */
      setWidth(newWidth: number) {
        self.width = newWidth
        for (const v of self.views) {
          v.setWidth(newWidth)
        }
      },

      /**
       * #action
       */
      setInteractiveOverlay(arg: boolean) {
        self.interactiveOverlay = arg
      },

      /**
       * #action
       */
      setShowIntraviewLinks(arg: boolean) {
        self.showIntraviewLinks = arg
      },

      /**
       * #action
       */
      setLinkViews(arg: boolean) {
        self.linkViews = arg
      },

      /**
       * #action
       */
      setShowHeader(arg: boolean) {
        self.showHeader = arg
      },

      /**
       * #action
       */
      setMatchedTrackFeatures(obj: Record<string, Feature[][]>) {
        self.matchedTrackFeatures = obj
      },
      /**
       * #action
       */
      reverseViewOrder() {
        self.views.reverse()
      },

      /**
       * #action
       */
      setInit(init?: BreakpointSplitViewInit) {
        self.init = init
      },

      /**
       * #action
       */
      setViews(
        viewInits: {
          loc?: string
          assembly: string
          tracks?: string[]
        }[],
      ) {
        self.views = cast(
          viewInits.map(viewInit => ({
            type: 'LinearGenomeView' as const,
            hideHeader: true,
            init: viewInit,
          })),
        )
      },
    }))
    .actions(self => ({
      afterAttach() {
        // Init autorun for initializing from session snapshot
        addDisposer(
          self,
          autorun(
            function breakpointSplitViewInitAutorun() {
              const { init, width } = self
              if (!width || !init) {
                return
              }

              // Set up the views with their init properties
              // The child LinearGenomeViews will handle their own initialization
              self.setViews(init.views)

              // Clear init state
              self.setInit(undefined)
            },
            { name: 'BreakpointSplitViewInit' },
          ),
        )
        addDisposer(
          self,
          autorun(async () => {
            try {
              // check all views 'initialized'
              if (!self.views.every(view => view.initialized)) {
                return
              }
              // check that tracks are 'ready' (not notReady)
              if (
                self.matchedTracks.some(track => track.displays[0].notReady?.())
              ) {
                return
              }

              self.setMatchedTrackFeatures(
                Object.fromEntries(
                  await Promise.all(
                    self.matchedTracks.map(async track => [
                      track.configuration.trackId,
                      await getBlockFeatures(self, track),
                    ]),
                  ),
                ),
              )
            } catch (e) {
              console.error(e)
              getSession(self).notifyError(`${e}`, e)
            }
          }),
        )
      },

      /**
       * #method
       */
      menuItems() {
        return [
          ...self.views.map((view, idx) => ({
            label: `Row ${idx + 1} view menu`,
            subMenu: view.menuItems(),
          })),

          ...(self.views.length > 1
            ? [
                {
                  label: 'Reverse view order',
                  onClick: () => {
                    self.reverseViewOrder()
                  },
                },
              ]
            : []),
          {
            label: 'Show header',
            type: 'checkbox',
            checked: self.showHeader,
            onClick: () => {
              self.setShowHeader(!self.showHeader)
            },
          },
          {
            label: 'Show intra-view links',
            type: 'checkbox',
            checked: self.showIntraviewLinks,
            onClick: () => {
              self.setShowIntraviewLinks(!self.showIntraviewLinks)
            },
          },
          {
            label: 'Allow clicking alignment squiggles?',
            type: 'checkbox',
            checked: self.interactiveOverlay,
            onClick: () => {
              self.setInteractiveOverlay(!self.interactiveOverlay)
            },
          },
          {
            label: 'Link views',
            type: 'checkbox',
            icon: LinkIcon,
            checked: self.linkViews,
            onClick: () => {
              self.setLinkViews(!self.linkViews)
            },
          },
          {
            label: 'Export SVG',
            icon: PhotoCamera,
            onClick: (): void => {
              getSession(self).queueDialog(handleClose => [
                ExportSvgDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
        ]
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        init,
        height,
        trackSelectorType,
        showIntraviewLinks,
        linkViews,
        interactiveOverlay,
        showHeader,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(height !== 400 ? { height } : {}),
        ...(trackSelectorType !== 'hierarchical' ? { trackSelectorType } : {}),
        ...(!showIntraviewLinks ? { showIntraviewLinks } : {}),
        ...(linkViews ? { linkViews } : {}),
        ...(!interactiveOverlay ? { interactiveOverlay } : {}),
        ...(showHeader ? { showHeader } : {}),
      } as typeof snap
    })
}

export type BreakpointViewStateModel = ReturnType<typeof stateModelFactory>
export type BreakpointViewModel = Instance<BreakpointViewStateModel>

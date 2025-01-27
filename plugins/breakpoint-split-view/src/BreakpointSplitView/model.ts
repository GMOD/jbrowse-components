import { lazy } from 'react'

import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession, notEmpty } from '@jbrowse/core/util'
import LinkIcon from '@mui/icons-material/Link'
import PhotoCamera from '@mui/icons-material/PhotoCamera'
import { saveAs } from 'file-saver'
import { autorun } from 'mobx'
import { addDisposer, getPath, onAction, types } from 'mobx-state-tree'

import { calc, getBlockFeatures, getClip, intersect } from './util'

import type { ExportSvgOptions } from './types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from 'mobx-state-tree'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog'))

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
        interactiveOverlay: true,
        /**
         * #property
         */
        views: types.array(
          pluginManager.getViewType('LinearGenomeView')!
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
          .filter(f => !!f)
      },

      /**
       * #method
       * Translocation features are handled differently since they do not have
       * a mate e.g. they are one sided
       */
      hasTranslocations(trackConfigId: string) {
        return [...this.getTrackFeatures(trackConfigId).values()].find(
          f => f.get('type') === 'translocation',
        )
      },

      /**
       * #method
       * Paired features similar to breakends, but simpler, like BEDPE
       */
      hasPairedFeatures(trackConfigId: string) {
        return [...this.getTrackFeatures(trackConfigId).values()].find(
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
                    clipPos: getClip(
                      feature.get('CIGAR'),
                      feature.get('strand'),
                    ),
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
        self.views.forEach(v => {
          v.setWidth(newWidth)
        })
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
      setMatchedTrackFeatures(obj: Record<string, Feature[][]>) {
        self.matchedTrackFeatures = obj
      },
      /**
       * #action
       */
      reverseViewOrder() {
        self.views.reverse()
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
                      await getBlockFeatures(self as any, track),
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
          ...self.views
            .map((view, idx) => [idx, view.menuItems()] as const)
            .map(f => ({
              label: `Row ${f[0] + 1} view menu`,
              subMenu: f[1],
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
}

export type BreakpointViewStateModel = ReturnType<typeof stateModelFactory>
export type BreakpointViewModel = Instance<BreakpointViewStateModel>

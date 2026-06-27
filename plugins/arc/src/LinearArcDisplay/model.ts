import type React from 'react'

import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { getSession, isFeature, openFeatureWidget } from '@jbrowse/core/util'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  RegionTooLargeMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

import { migrateArcSnapshot } from './migrate.ts'

import type {
  LinearArcDisplayConfig,
  LinearArcDisplayConfigModel,
} from './configSchema.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel LinearArcDisplay
 * a non-block-based display drawing an arc connecting the start and end of each
 * feature, rendered as plain SVG on the main thread
 *
 * #example
 * Selected on a `FeatureTrack`; each feature is drawn as an arc from its start
 * to its end. `displayMode` is `arcs` or `semicircles`:
 * ```js
 * {
 *   type: 'FeatureTrack',
 *   trackId: 'interactions',
 *   name: 'Interactions',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'Gff3TabixAdapter',
 *     uri: 'https://example.com/interactions.gff3.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearArcDisplay',
 *       displayId: 'interactions-LinearArcDisplay',
 *       displayMode: 'semicircles',
 *     },
 *   ],
 * }
 * ```
 */
export function stateModelFactory(configSchema: LinearArcDisplayConfigModel) {
  return types
    .compose(
      'LinearArcDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      RegionTooLargeMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearArcDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * explicit display-mode override; the `displayMode` getter resolves it
         * over the config `displayMode` slot
         */
        displayModeOverride: types.maybe(types.string),
      }),
    )
    .preProcessSnapshot((snap: Record<string, unknown> | undefined) =>
      migrateArcSnapshot(snap),
    )
    .volatile(() => ({
      features: undefined as Feature[] | undefined,
      loading: false,
    }))
    .views(self => ({
      /**
       * #getter
       * the config typed off the concrete schema; `ConfigurationReference`
       * erases `self.configuration` to `any`, so reads route through this to
       * stay typed (same move as `BaseAdapter<CONF>`)
       */
      get conf(): LinearArcDisplayConfig {
        return self.configuration
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the SVG-export terminal-state gate (the `SvgExportable` contract every
       * LGV track display shares). Arc fetches all features into a single array
       * via `FeatureDensityMixin`, so it has no `loadedRegions` spatial-coverage
       * signal like the GPU mixins — "settled" is just features-present / error
       * / too-large. Known gap: this stays true through an in-place refetch, so
       * an export fired immediately after a pan/zoom can capture stale arcs
       * (same stale-then-reposition behavior arc shows on-screen); tightening it
       * would need fetch-generation tracking the single-array model lacks.
       */
      get svgReady() {
        return (
          self.features !== undefined || !!self.error || self.regionTooLarge
        )
      },
      /**
       * #getter
       */
      get displayMode() {
        return (
          self.displayModeOverride ?? readConfObject(self.conf, 'displayMode')
        )
      },
      /**
       * #getter
       * per-feature arc styling, evaluated once when features/config change.
       * Kept out of the render loop so panning (which only changes pixel
       * positions) doesn't re-run these jexl expressions per feature per frame.
       */
      get arcStyles() {
        // thickness/arcHeight are numeric slots with jexl-string defaults; the
        // slot's declared `type: 'number'` is erased by the time it reaches the
        // value-type derivation (only the jexl default string survives, as
        // `string`), so a typed `self.conf` read would mistype them as string.
        // They stay on the untyped `getConf` read; the string-valued slots use
        // the typed `self.conf`.
        return self.features?.map(feature => ({
          feature,
          color: readConfObject(self.conf, 'color', { feature }),
          thickness: getConf(self, 'thickness', { feature }) ?? 2,
          label: readConfObject(self.conf, 'label', { feature }),
          caption: readConfObject(self.conf, 'caption', { feature }),
          arcHeight: Math.min(
            getConf(self, 'arcHeight', { feature }) ?? 100,
            self.height,
          ),
        }))
      },
      /**
       * #getter
       * returns the id of the globally-selected feature, used to highlight it
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
    }))
    .actions(self => ({
      /**
       * #action
       */
      selectFeature(feature: Feature) {
        openFeatureWidget(self, feature.toJSON())
      },
      /**
       * #action
       */
      setLoading(flag: boolean) {
        self.loading = flag
      },
      /**
       * #action
       */
      setFeatures(f: Feature[]) {
        self.features = f
      },
      /**
       * #action
       */
      setDisplayMode(flag: string) {
        self.displayModeOverride = flag
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('../shared/afterAttach.ts')
            doAfterAttach(self as LinearArcDisplayModel)
          } catch (e) {
            console.error(e)
            self.setError(e)
          }
        })()
      },
      /**
       * #action
       */
      async renderSvg(
        opts?: ExportSvgDisplayOptions,
      ): Promise<React.ReactNode> {
        const { renderArcSvg } = await import('./renderSvg.tsx')
        return renderArcSvg(self as LinearArcDisplayModel, opts)
      },
    }))
    .views(self => {
      const superMenuItems = self.trackMenuItems
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superMenuItems(),
            {
              label: 'Display mode',
              subMenu: [
                {
                  type: 'radio',
                  label: 'Arcs',
                  onClick: () => {
                    self.setDisplayMode('arcs')
                  },
                  checked: self.displayMode === 'arcs',
                },
                {
                  type: 'radio',
                  label: 'Semi-circles',
                  onClick: () => {
                    self.setDisplayMode('semicircles')
                  },
                  checked: self.displayMode === 'semicircles',
                },
              ],
            },
          ]
        },
      }
    })
}

export type LinearArcDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearArcDisplayModel = Instance<LinearArcDisplayStateModel>

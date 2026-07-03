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

import { currentRegionSignature } from '../shared/regionSignature.ts'

import type {
  LinearArcDisplayConfig,
  LinearArcDisplayConfigModel,
} from './configSchema.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel LinearArcDisplay
 * a non-block-based display drawing one arc per feature, connecting that
 * feature's own start and end, rendered as plain SVG on the main thread. For
 * arcs that connect two *separate* loci (a breakend and its mate) use
 * [LinearPairedArcDisplay](../linearpairedarcdisplay) instead.
 *
 * #example
 * Selected on a `FeatureTrack`; each feature is drawn as one arc from its start
 * to its end. `displayMode` is `arcs` (bezier) or `semicircles`. The
 * `thickness` and `label` slots default to expressions over the feature
 * `score`, so override them (plus `color` / `arcHeight`) for data without a
 * score:
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
 *       color: "jexl:get(feature,'strand')==-1?'red':'blue'",
 *       arcHeight: 80,
 *       label: "jexl:get(feature,'name')",
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
      }),
    )
    .volatile(() => ({
      features: undefined as Feature[] | undefined,
      // signature of the static-block region set `features` were fetched for;
      // drives the non-stale `svgReady` export gate (see regionSignature.ts)
      loadedRegionSignature: undefined as string | undefined,
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
       * LGV track display shares). Non-stale: `features` must have been fetched
       * for the *current* static-block region set (`loadedRegionSignature`
       * matches), so an export fired mid-refetch after a pan/zoom waits for
       * fresh arcs instead of capturing stale ones — arc's analogue of the GPU
       * mixins' `viewportWithinLoadedData`. The first-paint testid + loading
       * anti-flash use `features !== undefined` (painted-once) directly, not
       * this, so they don't flip on refetch (see BaseDisplayComponent).
       */
      get svgReady() {
        // `features` defined implies `loadedRegionSignature` is set (both from
        // one `setFeatures`), so it's the "have we loaded" guard; the signature
        // compare then rejects a stale in-flight refetch
        const fresh =
          self.features !== undefined &&
          self.loadedRegionSignature === currentRegionSignature(self)
        return fresh || !!self.error || self.regionTooLarge
      },
      /**
       * #getter
       */
      get displayMode() {
        return getConf(self, 'displayMode')
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
      setFeatures(f: Feature[], signature: string) {
        self.features = f
        self.loadedRegionSignature = signature
      },
      /**
       * #action
       */
      setDisplayMode(flag: string) {
        self.configuration.setSlot('displayMode', flag)
      },
      /**
       * #action
       * retry after an error: clearing `error` re-fires the (error-gated) fetch
       * autorun. The shared `DisplayErrorBar` retry calls this; the base
       * `reload` is a no-op, which would leave the display stuck on error.
       */
      reload() {
        self.setError(undefined)
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

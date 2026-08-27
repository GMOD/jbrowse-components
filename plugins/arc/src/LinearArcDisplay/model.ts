import {
  ConfigurationReference,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { makeRadioSubMenu } from '@jbrowse/core/ui/menuItems'
import { getSession, isFeature, openFeatureWidget } from '@jbrowse/core/util'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { isAlive, types } from '@jbrowse/mobx-state-tree'

import { ArcFetchModel } from '../shared/ArcFetchModel.ts'
import { filterByScore } from '../shared/scoreFilter.ts'
import { ARC_DISPLAY_MODE_OPTIONS } from './displayModes.ts'

import type {
  LinearArcDisplayConfig,
  LinearArcDisplayConfigModel,
} from './configSchema.ts'
import type { ArcDisplayMode } from './displayModes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel LinearArcDisplay
 * #displayFoundation GlobalFetchMixin
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
 *       color: "jexl:feature.strand==-1?'red':'blue'",
 *       arcHeight: 80,
 *       label: "jexl:feature.name",
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
      ArcFetchModel(() => import('./renderSvg.tsx')),
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
    .views(self => ({
      // #region chainedViews
      /**
       * #getter
       * the config typed off the concrete schema; `ConfigurationReference`
       * erases `self.configuration` to `any`, so reads route through this to
       * stay typed (same move as `BaseAdapter<CONF>`)
       */
      get conf(): LinearArcDisplayConfig {
        return self.configuration
      },
      /**
       * #getter
       */
      get displayMode(): ArcDisplayMode {
        return getConf(self, 'displayMode')
      },
      // #endregion
    }))
    .views(self => ({
      /**
       * #getter
       * per-feature arc styling, evaluated once when features/config change.
       * Kept out of the render loop so panning (which only changes pixel
       * positions) doesn't re-run these jexl expressions per feature per frame.
       */
      // #region contextVariableRead
      get arcStyles() {
        // thickness/arcHeight are `type: 'number'` slots, so getConf types (and
        // returns) a number — both have a default, so the read is never unset.
        // color/label/caption are string slots read through the typed self.conf.
        const kept =
          self.features && filterByScore(self.features, self.minScore)
        return kept?.map(feature => ({
          feature,
          color: readConfObject(self.conf, 'color', { feature }),
          thickness: getConf(self, 'thickness', { feature }),
          label: readConfObject(self.conf, 'label', { feature }),
          caption: readConfObject(self.conf, 'caption', { feature }),
          arcHeight: Math.min(
            getConf(self, 'arcHeight', { feature }),
            self.height,
          ),
        }))
      },
      // #endregion
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
      setDisplayMode(mode: ArcDisplayMode) {
        setConf(self, 'displayMode', mode)
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
            makeRadioSubMenu({
              label: 'Display mode',
              value: self.displayMode,
              onChange: mode => {
                self.setDisplayMode(mode)
              },
              options: ARC_DISPLAY_MODE_OPTIONS,
            }),
            ...self.scoreFilterMenuItems(),
          ]
        },
      }
    })
}

export type LinearArcDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearArcDisplayModel = Instance<LinearArcDisplayStateModel>

import {
  ConfigurationReference,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { makeRadioSubMenu } from '@jbrowse/core/ui/menuItems'
import { openFeatureWidget } from '@jbrowse/core/util'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { types } from '@jbrowse/mobx-state-tree'

import { ArcFetchModel } from '../shared/ArcFetchModel.ts'
import { layOutArcs } from '../shared/arcLayout.ts'
import { filterByScore } from '../shared/scoreFilter.ts'
import { ARC_DISPLAY_MODE_OPTIONS } from './displayModes.ts'

import type { LaidOutArc } from '../shared/arcLayout.ts'
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
 * feature's own start and end, drawn on a main-thread Canvas2D. For
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
      ArcFetchModel(() => import('../shared/renderArcSvg.tsx')),
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
    }))
    .views(self => ({
      /**
       * #getter
       */
      get displayMode(): ArcDisplayMode {
        return getConf(self, 'displayMode')
      },
      // #endregion
      /**
       * #getter
       * per-feature arc styling, evaluated once when features/config change.
       * Kept out of the render loop so panning (which only changes pixel
       * positions) doesn't re-run these jexl expressions per feature per frame.
       */
      // #region contextVariableRead
      get arcStyles() {
        // thickness/arcHeight are `type: 'number'` slots, so getConf types (and
        // returns) a number — a jexl default over an attribute the feature
        // lacks still evaluates to NaN; `layOutArcs` is where it is made
        // paintable.
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
    }))
    .views(self => ({
      /**
       * #getter
       * every arc placed in screen px by `layOutArcs`, which both displays
       * share. A computed rather than a component body, so MobX caches it
       * against the viewport and a hover redraws without re-placing anything.
       */
      get laidOutArcs(): LaidOutArc[] {
        const semicircle = self.displayMode === 'semicircles'
        return layOutArcs(self, self.arcStyles, (style, place) => {
          const { feature, color, thickness, label, caption, arcHeight } = style
          const refName = feature.get('refName')
          const l = place(refName, feature.get('start'))
          const r = place(refName, feature.get('end'))
          return (
            l &&
            r && {
              feature,
              key: feature.id(),
              shape: semicircle
                ? { kind: 'semicircle', left: l.x, right: r.x }
                : { kind: 'bezier', left: l.x, right: r.x, height: arcHeight },
              color,
              strokeWidth: thickness,
              label,
              caption,
            }
          )
        })
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

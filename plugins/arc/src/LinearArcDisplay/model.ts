import {
  ConfigurationReference,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { makeRadioSubMenu } from '@jbrowse/core/ui/menuItems'
import {
  getContainingView,
  getSession,
  isFeature,
  openFeatureWidget,
} from '@jbrowse/core/util'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { isAlive, types } from '@jbrowse/mobx-state-tree'

import { ArcFetchModel } from '../shared/ArcFetchModel.ts'
import { arcExtent } from '../shared/arcLayout.ts'
import { filterByScore } from '../shared/scoreFilter.ts'
import { ARC_DISPLAY_MODE_OPTIONS } from './displayModes.ts'

import type { LaidOutArc } from '../shared/arcLayout.ts'
import type { ArcShape } from '../shared/arcShape.ts'
import type {
  LinearArcDisplayConfig,
  LinearArcDisplayConfigModel,
} from './configSchema.ts'
import type { ArcDisplayMode } from './displayModes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
    .views(self => ({
      /**
       * #getter
       * every arc placed in screen px, `view.offsetPx` already subtracted — the
       * one thing that has to be re-derived when the viewport moves, and the
       * ONLY place this display reads `bpToPx`.
       *
       * A computed rather than a component body: each arc used to be its own
       * `observer` doing this projection for itself, so a zoom or a pan ran a
       * MobX reaction and patched three SVG attributes per arc per frame. MobX
       * caches this against the viewport, so a hover — which redraws — does not
       * re-place anything.
       */
      get laidOutArcs(): LaidOutArc[] {
        const view = getContainingView(self) as LinearGenomeViewModel
        const assembly = getSession(self).assemblyManager.get(
          view.assemblyNames[0]!,
        )
        if (!assembly || !view.initialized) {
          return []
        }
        const semicircle = self.displayMode === 'semicircles'
        const out: LaidOutArc[] = []
        for (const style of self.arcStyles ?? []) {
          const { feature, color, thickness, label, caption, arcHeight } = style
          const ra = assembly.getCanonicalRefName2(feature.get('refName'))
          const l = view.bpToPx({ refName: ra, coord: feature.get('start') })
          const r = view.bpToPx({ refName: ra, coord: feature.get('end') })
          if (l === undefined || r === undefined) {
            continue
          }
          const left = l.offsetPx - view.offsetPx
          const right = r.offsetPx - view.offsetPx
          const shape: ArcShape = semicircle
            ? { kind: 'semicircle', left, right }
            : { kind: 'bezier', left, right, height: arcHeight }
          out.push({
            feature,
            key: feature.id(),
            shape,
            color,
            strokeWidth: thickness,
            selected: self.selectedFeatureId === feature.id(),
            label,
            caption,
            ...arcExtent(shape, thickness),
          })
        }
        return out
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

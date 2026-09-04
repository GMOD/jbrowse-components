import {
  ConfigurationReference,
  readConfObject,
  resolveConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { dedupe, openFeatureWidget } from '@jbrowse/core/util'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { types } from '@jbrowse/mobx-state-tree'
import { breakendTickPx } from '@jbrowse/sv-core'

import { ArcFetchModel } from '../shared/ArcFetchModel.ts'
import { layOutArcs } from '../shared/arcLayout.ts'
import { filterByScore } from '../shared/scoreFilter.ts'
import { makeFeaturePair, makeSummary, pairKey } from './components/util.ts'
import { makeLineWidthMenuItem } from './lineWidthMenu.tsx'

import type { ArcPoint, ArcTick, LaidOutArc } from '../shared/arcLayout.ts'
import type {
  LinearPairedArcDisplayConfig,
  LinearPairedArcDisplayConfigModel,
} from './configSchema.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

// mate-direction ticks extend 20px past each endpoint
const TICK_PX = 20
// the ticks sit just inside the baseline, so their outer half is not clipped
const TICK_Y = 1.5

// One breakend's direction tick, or nothing when the record states no
// direction. A list so the two feet spread into one array with no branch.
// `mateDirection` is genomic and the two ends may sit in differently-oriented
// displayed regions, so each is mirrored by the region its own foot landed in.
function mateTick(p: ArcPoint, keepsDir: number | undefined): ArcTick[] {
  return keepsDir
    ? [
        {
          x1: p.x,
          x2: breakendTickPx(p.x, keepsDir, !!p.region?.reversed, TICK_PX),
          y: TICK_Y,
        },
      ]
    : []
}

/**
 * #stateModel LinearPairedArcDisplay
 * #displayFoundation GlobalFetchMixin
 * a non-block-based display that draws one arc per feature from its position to
 * its mate breakend (parsed from the VCF `ALT`), connecting the two loci of a
 * structural variant even across displayed regions / chromosomes; drawn on a
 * main-thread Canvas2D. For arcs that span a single feature's own
 * start–end use [LinearArcDisplay](../lineararcdisplay) instead.
 *
 * #example
 * Selected on a `VariantTrack` of structural variants: each feature draws an arc
 * from its position to its mate breakend, even when the mate is on another
 * chromosome / displayed region. Short ticks mark each breakend's mate
 * direction; clicking an arc opens the variant details:
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'sv',
 *   name: 'Structural variants',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     uri: 'https://example.com/sv.vcf.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearPairedArcDisplay',
 *       displayId: 'sv-LinearPairedArcDisplay',
 *     },
 *   ],
 * }
 * ```
 */
export function stateModelFactory(
  configSchema: LinearPairedArcDisplayConfigModel,
) {
  return types
    .compose(
      'LinearPairedArcDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      ArcFetchModel(() => import('../shared/renderArcSvg.tsx')),
      // #region configRef
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearPairedArcDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
      // #endregion
    )
    .views(self => ({
      /**
       * #getter
       * the config typed off the concrete schema; `ConfigurationReference`
       * erases `self.configuration` to `any`, so reads route through this to
       * stay typed (same move as `BaseAdapter<CONF>`)
       */
      get conf(): LinearPairedArcDisplayConfig {
        return self.configuration
      },
      /**
       * #getter
       * arc stroke width in px, from the promotable `lineWidth` slot (track-menu
       * slider writes it); flat across all arcs
       */
      get lineWidth(): number {
        return resolveConf(self, 'lineWidth')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * per-arc styling, endpoint pairs (one per ALT) and hover text, evaluated
       * once when features/config change. Keeps the color jexl and
       * makeFeaturePair (which runs parseSvAlt) out of the per-pan render loop.
       * Deduped on a canonical endpoint-pair key: a paired feature is emitted
       * from both endpoints and reciprocal BNDs arrive as two records, so the
       * same arc otherwise draws twice whenever both endpoints are in the
       * fetched regions.
       *
       * `caption` is here rather than resolved at hover time because the
       * component used to call `makeSummary` for every arc on every render. It
       * is handed the pair rather than rebuilding one, so `parseSvAlt` runs
       * once per arc.
       */
      get arcStyles() {
        const kept =
          self.features && filterByScore(self.features, self.minScore)
        const styles = kept?.flatMap(feature => {
          const alts = feature.get('ALT') as string[] | undefined
          const make = (alt: string | undefined) => {
            const pair = makeFeaturePair(feature, alt)
            return {
              feature,
              alt,
              color: readConfObject(self.conf, 'color', { feature, alt }),
              caption: makeSummary(feature, alt, pair),
              ...pair,
            }
          }
          return alts?.length ? alts.map(alt => make(alt)) : [make(undefined)]
        })
        return styles && dedupe(styles, s => pairKey(s.k1, s.k2))
      },
    }))
    .views(self => ({
      /**
       * #getter
       * every arc placed in screen px by `layOutArcs` — see the twin on
       * `LinearArcDisplay`. The two ends resolve through their OWN displayed
       * region, which `ArcPoint` carries for `mateTick`.
       */
      get laidOutArcs(): LaidOutArc[] {
        const { lineWidth, height } = self
        return layOutArcs(self, self.arcStyles, (style, place) => {
          const { feature, alt, color, caption, k1, k2 } = style
          const p1 = place(k1.refName, k1.start)
          const p2 = place(k2.refName, k2.start)
          const absrad = p1 && p2 ? Math.abs((p2.x - p1.x) / 2) : 0
          return p1 && p2 && absrad > 1
            ? {
                feature,
                key: `${feature.id()}-${alt ?? ''}`,
                shape: {
                  kind: 'bezier',
                  left: p1.x,
                  right: p2.x,
                  height: Math.min(height, absrad),
                },
                color,
                strokeWidth: lineWidth,
                ticks: [
                  ...mateTick(p1, k1.mateDirection),
                  ...mateTick(p2, k2.mateDirection),
                ],
                caption,
              }
            : undefined
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      selectFeature(feature: Feature) {
        openFeatureWidget(self, feature.toJSON(), {
          widget: { type: 'VariantFeatureWidget', id: 'variantFeature' },
        })
      },
      /**
       * #action
       * set arc stroke width; `undefined` resets to the config-slot default
       */
      setLineWidth(n?: number) {
        setConf(self, 'lineWidth', n)
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
            makeLineWidthMenuItem(self),
            ...self.scoreFilterMenuItems(),
          ]
        },
      }
    })
}

export type LinearPairedArcDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearPairedArcDisplayModel =
  Instance<LinearPairedArcDisplayStateModel>

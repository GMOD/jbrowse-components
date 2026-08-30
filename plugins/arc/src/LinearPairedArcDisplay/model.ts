import {
  ConfigurationReference,
  readConfObject,
  resolveConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  dedupe,
  getContainingView,
  getSession,
  openFeatureWidget,
} from '@jbrowse/core/util'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { types } from '@jbrowse/mobx-state-tree'
import { breakendTickPx } from '@jbrowse/sv-core'

import { ArcFetchModel } from '../shared/ArcFetchModel.ts'
import { arcExtent } from '../shared/arcLayout.ts'
import { filterByScore } from '../shared/scoreFilter.ts'
import { makeFeaturePair, makeSummary, pairKey } from './components/util.ts'
import { makeLineWidthMenuItem } from './lineWidthMenu.tsx'

import type { ArcTick, LaidOutArc } from '../shared/arcLayout.ts'
import type { ArcShape } from '../shared/arcShape.ts'
import type {
  LinearPairedArcDisplayConfig,
  LinearPairedArcDisplayConfigModel,
} from './configSchema.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// mate-direction ticks extend 20px past each endpoint
const TICK_PX = 20
// the ticks sit just inside the baseline, so their outer half is not clipped
const TICK_Y = 1.5

// One breakend's direction tick, or nothing when the record states no
// direction. A list rather than an optional value so the two feet spread into
// one array: an arc has zero, one or two of these, and the caller has no branch.
function mateTick(
  x: number,
  keepsDir: number | undefined,
  region?: { reversed?: boolean },
): ArcTick[] {
  return keepsDir
    ? [
        {
          x1: x,
          x2: breakendTickPx(x, keepsDir, !!region?.reversed, TICK_PX),
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
 * structural variant even across displayed regions / chromosomes; rendered as
 * plain SVG on the main thread. For arcs that span a single feature's own
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
       * `caption` is here rather than resolved at hover time because
       * `makeSummary` re-runs `parseSvAlt`, and the component used to call it
       * for every arc on every render.
       */
      get arcStyles() {
        const kept =
          self.features && filterByScore(self.features, self.minScore)
        const styles = kept?.flatMap(feature => {
          const alts = feature.get('ALT') as string[] | undefined
          const make = (alt: string | undefined) => ({
            feature,
            alt,
            color: readConfObject(self.conf, 'color', { feature, alt }),
            caption: makeSummary(feature, alt),
            ...makeFeaturePair(feature, alt),
          })
          return alts?.length ? alts.map(alt => make(alt)) : [make(undefined)]
        })
        return styles && dedupe(styles, s => pairKey(s.k1, s.k2))
      },
    }))
    .views(self => ({
      /**
       * #getter
       * every arc placed in screen px, `view.offsetPx` already subtracted — see
       * the twin on `LinearArcDisplay`. The ONLY place this display reads
       * `bpToPx`, and the reason a zoom no longer costs a MobX reaction per arc.
       *
       * The two ends resolve through their OWN displayed region: a session may
       * reverse one and not the other, and `mateDirection` is genomic, so each
       * tick is mirrored by the region its foot landed in rather than by the
       * view.
       */
      get laidOutArcs(): LaidOutArc[] {
        const view = getContainingView(self) as LinearGenomeViewModel
        const assembly = getSession(self).assemblyManager.get(
          view.assemblyNames[0]!,
        )
        if (!assembly || !view.initialized) {
          return []
        }
        const { lineWidth, height } = self
        const out: LaidOutArc[] = []
        for (const style of self.arcStyles ?? []) {
          const { feature, alt, color, caption, k1, k2 } = style
          const p1 = view.bpToPx({
            refName: assembly.getCanonicalRefName2(k1.refName),
            coord: k1.start,
          })
          const p2 = view.bpToPx({
            refName: assembly.getCanonicalRefName2(k2.refName),
            coord: k2.start,
          })
          if (p1 === undefined || p2 === undefined) {
            continue
          }
          const left = p1.offsetPx - view.offsetPx
          const right = p2.offsetPx - view.offsetPx
          const absrad = Math.abs((right - left) / 2)
          if (absrad <= 1) {
            continue
          }
          const shape: ArcShape = {
            kind: 'bezier',
            left,
            right,
            height: Math.min(height, absrad),
          }
          const ticks = [
            ...mateTick(
              left,
              k1.mateDirection,
              view.displayedRegions[p1.index],
            ),
            ...mateTick(
              right,
              k2.mateDirection,
              view.displayedRegions[p2.index],
            ),
          ]
          out.push({
            feature,
            key: `${feature.id()}-${alt ?? ''}`,
            shape,
            color,
            strokeWidth: lineWidth,
            selected: false,
            ticks: ticks.length > 0 ? ticks : undefined,
            caption,
            ...arcExtent(shape, lineWidth, ticks),
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

import {
  ConfigurationReference,
  getConf,
  readConfObject,
  resolveConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { dedupe, openFeatureWidget } from '@jbrowse/core/util'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { types } from '@jbrowse/mobx-state-tree'

import { ArcFetchModel } from '../shared/ArcFetchModel.ts'
import {
  featureScoreRange,
  filterByScore,
  makeScoreFilterMenuItem,
} from '../shared/scoreFilter.ts'
import { makeFeaturePair, pairKey } from './components/util.ts'
import { makeLineWidthMenuItem } from './lineWidthMenu.tsx'

import type {
  LinearPairedArcDisplayConfig,
  LinearPairedArcDisplayConfigModel,
} from './configSchema.ts'
import type { Feature } from '@jbrowse/core/util'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type React from 'react'

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
      // shared arc fetch/gating: cancel-safe runFetch, DERIVED regionTooLarge,
      // reload/svgReady contract — identical structure to LD, so arc has no
      // special fetch or region-too-large behavior
      ArcFetchModel(),
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
      /**
       * #getter
       * arcs whose feature scores below this are not drawn; 0 (the default)
       * draws every arc, as does any feature carrying no score
       */
      get minScore(): number {
        return getConf(self, 'minScore')
      },
      /**
       * #getter
       * the score span the filter slider is laid out over, `undefined` when the
       * loaded features give it nothing to filter on
       */
      get scoreRange() {
        return self.features && featureScoreRange(self.features)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * per-arc styling and endpoint pairs (one per ALT), evaluated once when
       * features/config change. Keeps the color jexl and makeFeaturePair (which
       * runs parseSvAlt) out of the per-pan render loop. Deduped on a canonical
       * endpoint-pair key: a paired feature is emitted from both endpoints and
       * reciprocal BNDs arrive as two records, so the same arc otherwise draws
       * twice whenever both endpoints are in the fetched regions.
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
            ...makeFeaturePair(feature, alt),
          })
          return alts?.length ? alts.map(alt => make(alt)) : [make(undefined)]
        })
        return styles && dedupe(styles, s => pairKey(s.k1, s.k2))
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
      /**
       * #action
       */
      setMinScore(score: number) {
        setConf(self, 'minScore', score)
      },
    }))

    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('../shared/afterAttach.ts')
            doAfterAttach(self as LinearPairedArcDisplayModel)
          } catch (e) {
            console.error(e)
            self.setError(e)
          }
        })()
      },
      /**
       * #action
       */
      // opts is accepted (the export framework calls every display's renderSvg
      // with it) but unused: arc paints vector JSX, not a paintLayer.
      //
      // One `import()`, and `renderSvg.tsx` is the edge behind it — it pairs the
      // shared export body with this display's `<Arcs>` using ordinary static
      // imports, so the whole export path is a single chunk. Don't inline it
      // into two dynamic imports here; see that file.
      async renderSvg(
        _opts?: ExportSvgDisplayOptions,
      ): Promise<React.ReactNode> {
        const { renderArcSvg } = await import('./renderSvg.tsx')
        return renderArcSvg(self as LinearPairedArcDisplayModel)
      },
    }))
    .views(self => {
      const superMenuItems = self.trackMenuItems
      return {
        /**
         * #method
         */
        trackMenuItems() {
          const { scoreRange } = self
          return [
            ...superMenuItems(),
            makeLineWidthMenuItem(self),
            // left out entirely when the data has no score span to filter on,
            // rather than shown as a slider whose ends mean the same thing
            ...(scoreRange ? [makeScoreFilterMenuItem(self, scoreRange)] : []),
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

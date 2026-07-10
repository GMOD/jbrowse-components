import type React from 'react'

import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { dedupe, openFeatureWidget } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  RegionTooLargeMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

import { makeFeaturePair, pairKey } from './components/util.ts'
import { currentRegionSignature } from '../shared/regionSignature.ts'

import type {
  LinearPairedArcDisplayConfig,
  LinearPairedArcDisplayConfigModel,
} from './configSchema.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel LinearPairedArcDisplay
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
      RegionTooLargeMixin(),
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
      get conf(): LinearPairedArcDisplayConfig {
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
       * per-arc styling and endpoint pairs (one per ALT), evaluated once when
       * features/config change. Keeps the color jexl and makeFeaturePair (which
       * runs parseSvAlt) out of the per-pan render loop. Deduped on a canonical
       * endpoint-pair key: a paired feature is emitted from both endpoints and
       * reciprocal BNDs arrive as two records, so the same arc otherwise draws
       * twice whenever both endpoints are in the fetched regions.
       */
      get arcStyles() {
        const styles = self.features?.flatMap(feature => {
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
      async renderSvg(
        opts?: ExportSvgDisplayOptions,
      ): Promise<React.ReactNode> {
        const { renderArcSvg } = await import('./renderSvg.tsx')
        return renderArcSvg(self as LinearPairedArcDisplayModel, opts)
      },
    }))
}

export type LinearPairedArcDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearPairedArcDisplayModel =
  Instance<LinearPairedArcDisplayStateModel>

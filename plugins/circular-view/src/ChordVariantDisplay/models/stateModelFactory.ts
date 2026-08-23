import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { computeSvgReady } from '@jbrowse/core/svg/svgReady'
import {
  createStatusFanOut,
  getContainingView,
  getEnv,
  getSession,
  isFeature,
} from '@jbrowse/core/util'
import { installFetch } from '@jbrowse/core/util/installFetch'
import {
  getRpcSessionId,
  getTrackAssemblyNames,
} from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'

import type {
  CircularViewModel,
  ExportSvgOptions,
} from '../../CircularView/model.ts'
import type { Slice } from '../../CircularView/slices.ts'
import type { ChordVariantDisplayConfigModel } from './configSchema.ts'
import type { Feature } from '@jbrowse/core/util'
import type { ThemeOptions } from '@mui/material'

const ErrorMessageStackTraceDialog = lazy(
  () => import('@jbrowse/core/ui/ErrorMessageStackTraceDialog'),
)

/**
 * #stateModel ChordVariantDisplay
 *
 * #example
 * The circular-view display for a `VariantTrack` of structural variants;
 * translocations are drawn as chords across the circle. The track config below
 * is what creates it; its colors are the config slots on
 * [](/docs/config/chordvariantdisplay):
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
 *       type: 'ChordVariantDisplay',
 *       displayId: 'sv-ChordVariantDisplay',
 *     },
 *   ],
 * }
 * ```
 * `bezierRadiusRatio` below is a property of this model rather than a config
 * slot: it sets the deepest bow toward the center, which a chord straight across
 * the circle reaches, and a shorter-range one bows in proportion to its span.
 * Nothing in the UI sets it and a track config drops it, so today only a
 * hand-edited session carries a value other than the default.
 */
const stateModelFactory = (configSchema: ChordVariantDisplayConfigModel) => {
  return types
    .compose(
      'ChordVariantDisplay',
      BaseDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('ChordVariantDisplay'),
        /**
         * #property
         */
        bezierRadiusRatio: types.stripDefault(types.number, 0.1),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      features: undefined as Feature[] | undefined,
      /**
       * #volatile
       */
      refNameMap: undefined as Record<string, string> | undefined,
      /**
       * #volatile
       * pure "go again" signal for the fetch autorun, the same role
       * `reloadCounter` plays in the three fetch families: after a fetch error
       * every other input is unchanged, so without it nothing can rewake the
       * fetch
       */
      reloadCounter: 0,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get view() {
        return getContainingView(self) as CircularViewModel
      },
      /**
       * #getter
       * Same name and same meaning as `FetchMixin.fetchInert` and
       * `SyntenyFetchStateMixin.fetchInert`, on a display that composes
       * neither: the fetch autorun deliberately never runs while the view holds
       * no displayed regions, and the view menu offers its track selector from
       * the import form — so a track opened there rests forever in "fetch not
       * started". Two readers, which is why it is one name: the SVG export
       * (`awaitSvgReady` is an unbounded `when`, so it would hang with the
       * dialog's spinner up and nothing said) and the dev-only retry check the
       * fetch skeleton installs, which would otherwise call that decline a dead
       * Retry button.
       */
      get fetchInert() {
        return !this.view.displayedRegions.length
      },
      /**
       * #getter
       * both halves of a chord render: the features, and the refName map that
       * translates the assembly's names to the adapter's. `blocksForRefs` falls
       * back to untranslated names while the map is in flight, so a render that
       * only waited on features could draw a figure with every chord silently
       * dropped (whenever the adapter names differ, e.g. `1` vs `chr1`).
       */
      get ready() {
        return self.features !== undefined && self.refNameMap !== undefined
      },

      /**
       * #getter
       * Off-screen SVG export gate: "Export SVG" waits on this before drawing
       * (see the [SVG export guide](/docs/developer_guides/svg_export)). Chord
       * displays are non-rectangular (radial), so on screen they keep a bespoke
       * `<DisplayError>` error UI instead of `SvgChrome`; the export has no box
       * to draw one in either, and doesn't try — `awaitSvgReady` fails the
       * export on a chord track that wouldn't load. Same shared
       * `computeSvgReady` policy as every other display, awaited the same shared
       * way — no inlined `when()`. No `regionTooLarge` state, and a chord fetch
       * covers the whole view at once, so `ready` (features and refName map
       * arrived) is the whole freshness axis.
       */
      get svgReady() {
        return computeSvgReady(
          {
            error: self.error,
            regionTooLarge: false,
            extraTerminal: this.fetchInert,
            // chord has no cancel affordance, so there is no such resting state
            fetchCanceled: false,
          },
          () => this.ready,
        )
      },

      /**
       * #getter
       */
      get radiusPx() {
        return this.view.radiusPx
      },

      /**
       * #getter
       * the deepest a chord bows toward the center, which a chord straight
       * across the circle reaches. A shorter one bows in proportion to how far
       * apart its ends are — see `chordControlRadius`
       */
      get bezierRadius() {
        return this.radiusPx * self.bezierRadiusRatio
      },

      /**
       * #getter
       * every slice of the circle, keyed by the refName a feature off this
       * display's adapter carries. An elided slice answers to each of the
       * refNames it swallowed
       */
      get blocksForRefs(): Record<string, Slice> {
        const result: Record<string, Slice> = {}
        for (const block of this.view.staticSlices) {
          const regions = block.region.elided
            ? block.region.regions
            : [block.region]
          for (const region of regions) {
            const refName = self.refNameMap?.[region.refName] ?? region.refName
            result[refName] = block
          }
        }
        return result
      },

      /**
       * #getter
       */
      get selectedFeatureId() {
        if (!isAlive(self)) {
          return undefined
        }
        const { selection } = getSession(self)
        return isFeature(selection) ? selection.id() : undefined
      },
    }))
    .actions(self => {
      const { pluginManager } = getEnv(self)
      return {
        /**
         * #action
         */
        onChordClick(feature: Feature) {
          getConf(self, 'onChordClick', { feature, track: self, pluginManager })
        },

        /**
         * #action
         */
        openErrorDialog() {
          getSession(self).queueDialog(onClose => [
            ErrorMessageStackTraceDialog,
            { onClose, error: self.error },
          ])
        },

        /**
         * #action
         */
        setFeatures(features: Feature[] | undefined) {
          self.features = features
          self.error = undefined
        },

        /**
         * #action
         */
        setRefNameMap(refNameMap: Record<string, string> | undefined) {
          self.refNameMap = refNameMap
        },

        /**
         * #action
         */
        reload() {
          self.reloadCounter += 1
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        // One fetch, not two: the features and the refName map are both
        // prerequisites for drawing a single chord (`ready` waits on both), and
        // they shared one `error` slot. Split across two autoruns with
        // different dependencies, a refName map that failed to load never got
        // asked for again — while the next displayedRegions change re-ran the
        // *feature* fetch, whose `setFeatures(undefined)` cleared the error out
        // from under it. The display then sat on the loading hatch forever with
        // nothing said. Fetched together, any retrigger retries both, and
        // `getRefNameMapForAdapter` is memoized per adapter config (and evicts
        // on failure), so asking again alongside every feature fetch costs a
        // resolved promise.
        //
        // The shared skeleton owns the rest — the latest-wins rotation and the
        // disposer that stops the LAST token (which a rotation written by hand
        // always misses), the unconditional `reloadCounter` read, the
        // currency-guarded error rule, the retired status slot, the leading
        // edge, and the two dev-only contract checks this fetch went without.
        installFetch(self, {
          name: 'ChordVariantDisplayFetch',
          delay: 300,
          report: self,
          contract: "ChordVariantDisplay's chord fetch",
          prepare: () => {
            const { view } = self
            return view.displayedRegions.length
              ? {
                  sessionId: getRpcSessionId(self),
                  adapterConfig: structuredClone(self.adapterConfig),
                  regions: structuredClone(view.displayedRegions),
                  assemblyName: getTrackAssemblyNames(self.parentTrack)[0]!,
                  adapter: getConf(self.parentTrack, 'adapter'),
                }
              : undefined
          },
          // The two halves run concurrently and would otherwise fight over the
          // one status field, so each gets its own fan-out slot.
          run: async (
            { sessionId, adapterConfig, regions, assemblyName, adapter },
            ctx,
          ) => {
            const { rpcManager, assemblyManager } = getSession(self)
            const slot = createStatusFanOut(ctx.statusCallback)
            const [features, refNameMap] = await Promise.all([
              rpcManager.call(sessionId, 'CoreGetFeatures', {
                adapterConfig,
                regions,
                stopToken: ctx.stopToken,
                statusCallback: slot(),
              }),
              assemblyManager.getRefNameMapForAdapter(adapter, assemblyName, {
                stopToken: ctx.stopToken,
                sessionId,
                statusCallback: slot(),
              }),
            ])
            return { features, refNameMap }
          },
          commit: ({ features, refNameMap }) => {
            self.setRefNameMap(refNameMap)
            self.setFeatures(features)
          },
          // The blank stays, and is not an artefact of the hand-rolled shape it
          // came from: this display answers freshness with `ready` alone — no
          // signature, no spatial map — so stale halves left in place read as
          // ready, and the old map names the previous assembly's refs, which
          // would let a render key itself on names this adapter no longer has.
          onBegin: () => {
            self.setRefNameMap(undefined)
            self.setFeatures(undefined)
          },
          setError: error => {
            self.setError(error)
          },
        })
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      async renderSvg(_opts: ExportSvgOptions & { theme?: ThemeOptions }) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self)
      },
    }))
}

export default stateModelFactory

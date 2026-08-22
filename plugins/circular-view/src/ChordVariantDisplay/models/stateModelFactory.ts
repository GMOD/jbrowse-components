import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { computeSvgReady } from '@jbrowse/core/svg/svgReady'
import {
  createStatusFanOut,
  createStopTokenRotation,
  getContainingView,
  getEnv,
  getSession,
  handleFetchError,
  isFeature,
} from '@jbrowse/core/util'
import {
  getRpcSessionId,
  getTrackAssemblyNames,
} from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

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
            // the feature fetch below never runs while the view has no
            // displayed regions, and the view menu offers its track selector
            // from the import form — so a track opened there rests forever in
            // "fetch not started", and an export awaiting `ready` would hang
            // with the dialog's spinner up and nothing said
            extraTerminal: !this.view.displayedRegions.length,
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
    .actions(self => {
      // the shared latest-wins rotation rather than a hand-rolled pair of
      // locals: it also owns the disposer that stops the *last* token, which a
      // rotation written by hand always misses — every fetch but the final one
      // is released by its successor, and that one is left holding a blob URL
      // and its AbortControllers for the life of the document
      const rotation = createStopTokenRotation(self, self)

      return {
        afterAttach() {
          addDisposer(self, () => {
            rotation.dispose()
          })
          addDisposer(
            self,
            autorun(
              // One fetch, not two: the features and the refName map are both
              // prerequisites for drawing a single chord (`ready` waits on
              // both), and they shared one `error` slot. Split across two
              // autoruns with different dependencies, a refName map that failed
              // to load never got asked for again — while the next
              // displayedRegions change re-ran the *feature* fetch, whose
              // `setFeatures(undefined)` cleared the error out from under it.
              // The display then sat on the loading hatch forever with nothing
              // said. Fetched together, any retrigger retries both, and
              // `getRefNameMapForAdapter` is memoized per adapter config (and
              // evicts on failure), so asking again alongside every feature
              // fetch costs a resolved promise.
              async function chordVariantFetch() {
                // read above every gate so `reload()` rewakes the autorun even
                // when no other input changed (a read under a gate drops out of
                // the dependency set on the run that declines)
                void self.reloadCounter
                const { view } = self
                if (!view.displayedRegions.length) {
                  return
                }
                const sessionId = getRpcSessionId(self)
                const adapterConfig = structuredClone(self.adapterConfig)
                const regions = structuredClone(view.displayedRegions)
                const assemblyNames = getTrackAssemblyNames(self.parentTrack)
                const adapter = getConf(self.parentTrack, 'adapter')
                const { rpcManager, assemblyManager } = getSession(self)

                const { stopToken, isCurrent, statusCallback, end } =
                  rotation.begin()
                // the two below run concurrently and would otherwise fight over
                // the one status field, so each gets its own slot
                const slot = createStatusFanOut(statusCallback)

                // the old map named the old assembly's refs; keeping it while
                // the new one loads would let `ready` wave through a render
                // keyed on names this adapter no longer has
                self.setRefNameMap(undefined)
                self.setFeatures(undefined)

                try {
                  const [feats, refNameMap] = await Promise.all([
                    rpcManager.call(sessionId, 'CoreGetFeatures', {
                      adapterConfig,
                      regions,
                      stopToken,
                      statusCallback: slot(),
                    }),
                    assemblyManager.getRefNameMapForAdapter(
                      adapter,
                      assemblyNames[0],
                      { stopToken, sessionId, statusCallback: slot() },
                    ),
                  ])
                  if (isCurrent()) {
                    self.setRefNameMap(refNameMap)
                    self.setFeatures(feats)
                  }
                } catch (e) {
                  handleFetchError(e, isCurrent, err => {
                    self.setError(err)
                  })
                } finally {
                  // the clear this fetch never had. Its phases close onto `''`,
                  // which no aggregate rewrites into a blank (ADR-080), so
                  // without this the last label stayed up for good — and the
                  // slot behind it went on voting for a phase that was over.
                  end()
                }
              },
              { name: 'ChordVariantDisplayFetch' },
            ),
          )
        },
      }
    })
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

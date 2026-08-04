import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { computeSvgReady } from '@jbrowse/core/svg/svgReady'
import {
  getContainingView,
  getEnv,
  getSession,
  isAbortException,
  isFeature,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
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
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { ThemeOptions } from '@mui/material'

const ErrorMessageStackTraceDialog = lazy(
  () => import('@jbrowse/core/ui/ErrorMessageStackTraceDialog'),
)

/**
 * #stateModel ChordVariantDisplay
 *
 * #example
 * The circular-view display for a `VariantTrack` of structural variants;
 * translocations are drawn as chords across the circle. `bezierRadiusRatio`
 * controls how far the chords bow toward the center:
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
 *       bezierRadiusRatio: 0.1,
 *     },
 *   ],
 * }
 * ```
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
       * displays are non-rectangular (radial), so they keep a bespoke
       * `<DisplayError>` error UI instead of `SvgChrome`, but they run the same
       * shared `computeSvgReady` policy and await it via the shared
       * `awaitSvgReady` — no inlined `when()`. No `regionTooLarge` state, and a
       * chord fetch covers the whole view at once, so `ready` (features and
       * refName map arrived) is the whole freshness axis.
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
       * how far chords bow toward the center
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
      }
    })
    .actions(self => {
      let renderStopToken: StopToken | undefined
      let refNameStopToken: StopToken | undefined

      return {
        afterAttach() {
          addDisposer(
            self,
            autorun(async () => {
              const { view } = self
              if (view.displayedRegions.length) {
                const sessionId = getRpcSessionId(self)
                const adapterConfig = structuredClone(self.adapterConfig)
                const regions = structuredClone(view.displayedRegions)
                const { rpcManager } = getSession(view)

                if (renderStopToken) {
                  stopStopToken(renderStopToken)
                }
                const stopToken = createStopToken()
                renderStopToken = stopToken

                self.setFeatures(undefined)

                try {
                  const feats = await rpcManager.call(
                    sessionId,
                    'CoreGetFeatures',
                    { adapterConfig, regions, stopToken },
                  )
                  if (isAlive(self) && renderStopToken === stopToken) {
                    self.setFeatures(feats)
                  }
                } catch (e) {
                  if (
                    !isAbortException(e) &&
                    isAlive(self) &&
                    renderStopToken === stopToken
                  ) {
                    console.error(e)
                    self.setError(e)
                  }
                }
              }
            }),
          )

          addDisposer(
            self,
            autorun(async () => {
              const assemblyNames = getTrackAssemblyNames(self.parentTrack)
              const adapter = getConf(self.parentTrack, 'adapter')
              const { assemblyManager } = getSession(self)
              const sessionId = getRpcSessionId(self)

              if (refNameStopToken) {
                stopStopToken(refNameStopToken)
              }
              const stopToken = createStopToken()
              refNameStopToken = stopToken

              // the old map named the old assembly's refs; keeping it while the
              // new one loads would let `ready` wave through a render keyed on
              // names this adapter no longer has
              self.setRefNameMap(undefined)

              try {
                const refNameMap =
                  await assemblyManager.getRefNameMapForAdapter(
                    adapter,
                    assemblyNames[0],
                    { stopToken, sessionId },
                  )
                if (isAlive(self) && refNameStopToken === stopToken) {
                  self.setRefNameMap(refNameMap)
                }
              } catch (e) {
                if (
                  !isAbortException(e) &&
                  isAlive(self) &&
                  refNameStopToken === stopToken
                ) {
                  console.error(e)
                  self.setError(e)
                }
              }
            }),
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

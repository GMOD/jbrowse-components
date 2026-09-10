import { lazy } from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { computeSvgReady } from '@jbrowse/core/svg/svgReady'
import {
  getContainingView,
  getDialogHost,
  getSession,
  isFeature,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { fanOutStatus } from '@jbrowse/core/util/fetchContext'
import { installFetch } from '@jbrowse/core/util/installFetch'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import { computeDisplayStatusPhase } from '@jbrowse/render-core/displayPhase'
import {
  adapterAssemblyNames,
  regionsInAssemblyNamespace,
  renameRegionsForAdapter,
} from '@jbrowse/synteny-core'

import type {
  CircularViewModel,
  ExportSvgOptions,
} from '../../CircularView/model.ts'
import type { Slice } from '../../CircularView/slices.ts'
import type { ChordSyntenyDisplayConfigModel } from './configSchema.ts'
import type { Feature } from '@jbrowse/core/util'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'
import type { ThemeOptions } from '@mui/material'

const ErrorMessageStackTraceDialog = lazy(
  () => import('@jbrowse/core/ui/ErrorMessageStackTraceDialog'),
)

// One assembly on the circle, as the adapter spells it: the name its
// `assemblyNames` uses for it, and its canonical-to-adapter refName map. Both
// sides of a synteny record are written in that namespace, so this is what
// turns a slice into something a feature off the wire can be looked up by.
interface AdapterNames {
  assemblyName: string
  refNameMap: Record<string, string>
}

function sliceKey(assemblyName: string | undefined, refName: string) {
  return `${assemblyName ?? ''}\u0000${refName}`
}

/**
 * #stateModel ChordSyntenyDisplay
 *
 * #example
 * The circular-view display for a `SyntenyTrack`: each alignment is drawn as a
 * ribbon between its span on one side and its mate's span on the other, so an
 * inversion reads as a twist. The track config below is what creates it; its
 * colors are the config slots on [](/docs/config/chordsyntenydisplay):
 * ```js
 * {
 *   type: 'SyntenyTrack',
 *   trackId: 'volvox_self',
 *   name: 'Volvox self-alignment',
 *   assemblyNames: ['volvox', 'volvox'],
 *   adapter: {
 *     type: 'PAFAdapter',
 *     uri: 'https://example.com/volvox_self.paf',
 *     queryAssembly: 'volvox',
 *     targetAssembly: 'volvox',
 *   },
 *   displays: [
 *     {
 *       type: 'ChordSyntenyDisplay',
 *       displayId: 'volvox_self-ChordSyntenyDisplay',
 *     },
 *   ],
 * }
 * ```
 * A track aligning two assemblies needs both of them on the circle, which is
 * the view's `assembly: ['hg38', 'mm39']` — see the
 * [synteny track guide](/docs/config_guides/synteny_track).
 */
const stateModelFactory = (configSchema: ChordSyntenyDisplayConfigModel) => {
  return types
    .compose(
      'ChordSyntenyDisplay',
      BaseDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('ChordSyntenyDisplay'),
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
       * one entry per assembly the circle draws, keyed by the canonical name
       */
      adapterNames: undefined as Record<string, AdapterNames> | undefined,
      /**
       * #volatile
       * pure "go again" signal for the fetch autorun, the same role
       * `reloadCounter` plays in the three fetch families
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
       * Same name and same meaning as `FetchMixin.fetchInert`, on a display
       * that does not compose it: the fetch autorun never runs while the view
       * holds no displayed regions, so a track opened from the import form's
       * track selector rests forever in "fetch not started". The SVG export's
       * unbounded `when` and the retry-contract check both read it.
       */
      get fetchInert() {
        return !this.view.displayedRegions.length
      },
      /**
       * #getter
       * both halves of a ribbon render: the alignments, and the per-assembly
       * name tables that place each of their two ends
       */
      get ready() {
        return self.features !== undefined && self.adapterNames !== undefined
      },
      /**
       * #getter
       * Off-screen SVG export gate, on the same shared `computeSvgReady`
       * policy as every other display. A radial display has no box to draw an
       * error in, so `awaitSvgReady` fails the export rather than exporting a
       * message.
       */
      get svgReady() {
        return computeSvgReady(
          {
            error: self.error,
            regionTooLarge: false,
            extraTerminal: this.fetchInert,
            fetchCanceled: false,
          },
          () => this.ready,
        )
      },
      /**
       * #getter
       */
      get displayPhase(): DisplayStatusPhase {
        return computeDisplayStatusPhase(
          { regionTooLarge: false, error: self.error },
          () => !this.fetchInert && !this.ready,
        )
      },
      /**
       * #getter
       */
      get radiusPx() {
        return this.view.chordRadiusPx
      },
      /**
       * #getter
       * the deepest a ribbon bows toward the center, which one straight across
       * the circle reaches — see `chordControlRadius`
       */
      get bezierRadius() {
        return this.radiusPx * self.bezierRadiusRatio
      },
      /**
       * #getter
       * every slice of the circle, keyed by the assembly AND refName a feature
       * off this display's adapter carries. Both halves are needed: a two-
       * assembly circle can carry a `chr1` twice, and a refName-keyed table
       * answers whichever slice was written last. An elided slice answers to
       * each of the refNames it swallowed.
       */
      get sliceIndex(): Record<string, Slice> {
        const result: Record<string, Slice> = {}
        for (const block of this.view.staticSlices) {
          const regions = block.region.elided
            ? block.region.regions
            : [block.region]
          for (const region of regions) {
            const names = self.adapterNames?.[region.assemblyName]
            result[
              sliceKey(
                names?.assemblyName ?? region.assemblyName,
                names?.refNameMap[region.refName] ?? region.refName,
              )
            ] = block
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
      /**
       * #getter
       */
      get featureNoun() {
        return 'alignment'
      },
      /**
       * #getter
       * the panel the linear synteny displays open for the same record, so a
       * ribbon clicked on the circle and a ribbon clicked in a synteny view
       * share one drawer entry
       */
      get featureWidgetType() {
        return { type: 'SyntenyFeatureWidget', id: 'syntenyFeature' }
      },
    }))
    .views(self => ({
      /**
       * #method
       * the slice one end of an alignment lands on. The assembly falls back to
       * the circle's only one, for an adapter that leaves it off a mate.
       */
      sliceFor(assemblyName: string | undefined, refName: string) {
        const direct = self.sliceIndex[sliceKey(assemblyName, refName)]
        if (direct) {
          return direct
        }
        const { assemblyNames } = self.view
        const only = assemblyNames.length === 1 ? assemblyNames[0] : undefined
        return only === undefined
          ? undefined
          : self.sliceIndex[
              sliceKey(self.adapterNames?.[only]?.assemblyName ?? only, refName)
            ]
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      onRibbonClick(feature: Feature) {
        openFeatureWidget(self, feature.toJSON(), {
          widget: self.featureWidgetType,
          feature,
        })
      },
      /**
       * #action
       */
      openErrorDialog() {
        getDialogHost(self).queueDialog(onClose => [
          ErrorMessageStackTraceDialog,
          { onClose, error: self.error },
        ])
      },
      /**
       * #action
       */
      setFeatures(features: Feature[] | undefined) {
        self.features = features
      },
      /**
       * #action
       */
      setAdapterNames(names: Record<string, AdapterNames> | undefined) {
        self.adapterNames = names
      },
      /**
       * #action
       */
      reload() {
        self.reloadCounter += 1
      },
    }))
    .actions(self => ({
      afterAttach() {
        // One fetch, not two: the alignments and the name tables are both
        // prerequisites for placing a single ribbon (`ready` waits on both),
        // and they share one `error` slot — split in two, a name table that
        // failed to load never got asked for again while the next
        // displayedRegions change cleared its error out from under it. The
        // shared skeleton owns the latest-wins rotation, the disposer, the
        // unconditional `reloadCounter` read and the display-contract checks.
        installFetch(self, {
          name: 'ChordSyntenyDisplayFetch',
          delay: 300,
          report: self,
          contract: "ChordSyntenyDisplay's ribbon fetch",
          prepare: () => {
            const { view } = self
            return view.displayedRegions.length
              ? {
                  sessionId: getRpcSessionId(self),
                  adapterConfig: structuredClone(self.adapterConfig),
                  regions: structuredClone(view.displayedRegions),
                  assemblyNames: [...view.assemblyNames],
                }
              : undefined
          },
          run: async (
            { sessionId, adapterConfig, regions, assemblyNames },
            ctx,
          ) => {
            const { assemblyManager } = getSession(self)
            // A worker has no assembly manager, and a pairwise adapter
            // compares the region's assembly name against its own config text
            // — so an alias has to be spelled the adapter's way before the
            // RPC, not after (REFNAME_NAMESPACES.md). `renameRegionsForAdapter`
            // does that and the refNames in one pass.
            const renamed = await renameRegionsForAdapter({
              assemblyManager,
              sessionId,
              adapterConfig,
              regions,
            })
            const spelled = regionsInAssemblyNamespace(
              assemblyNames.map(assemblyName => ({ assemblyName })),
              adapterAssemblyNames(adapterConfig),
              assemblyManager,
            )
            const [featCtx, mapCtx] = fanOutStatus(ctx, 2)
            const [features, maps] = await Promise.all([
              featCtx!.callRpc('CoreGetFeatures', {
                adapterConfig,
                regions: renamed,
              }),
              Promise.all(
                assemblyNames.map(async (name, i) => {
                  const refNameMap =
                    await assemblyManager.getRefNameMapForAdapter(
                      adapterConfig,
                      name,
                      {
                        stopToken: mapCtx!.stopToken,
                        sessionId,
                        statusCallback: mapCtx!.statusCallback,
                      },
                    )
                  return [
                    name,
                    { assemblyName: spelled[i]!.assemblyName, refNameMap },
                  ] as const
                }),
              ),
            ])
            return { features, adapterNames: Object.fromEntries(maps) }
          },
          commit: ({ features, adapterNames }) => {
            self.setAdapterNames(adapterNames)
            self.setFeatures(features)
          },
          // this display answers freshness with `ready` alone — no signature,
          // no spatial map — so a stale half left in place reads as ready, and
          // the old tables name the previous assembly's contigs
          onBegin: () => {
            self.setAdapterNames(undefined)
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

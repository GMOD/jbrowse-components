import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { computeSvgReady } from '@jbrowse/core/svg/svgReady'
import {
  getContainingTrack,
  getContainingView,
  getDialogHost,
  getSession,
  isFeature,
} from '@jbrowse/core/util'
import { fanOutStatus } from '@jbrowse/core/util/fetchContext'
import { installFetch } from '@jbrowse/core/util/installFetch'
import {
  getConfAssemblyNamesOrNone,
  getRpcSessionId,
  isSameAssemblyName,
} from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import { computeDisplayStatusPhase } from '@jbrowse/render-core/displayPhase'
import {
  adapterAssemblyNames,
  regionsInAssemblyNamespace,
} from '@jbrowse/synteny-core'

import type { CircularViewModel } from '../CircularView/model.ts'
import type { Slice } from '../CircularView/slices.ts'
import type { ChordConfigModel } from './chordConfigSchemaFields.ts'
import type { Feature } from '@jbrowse/core/util'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { Region } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

const ErrorMessageStackTraceDialog = lazy(
  () => import('@jbrowse/core/ui/ErrorMessageStackTraceDialog'),
)

/**
 * One assembly on the circle as the adapter spells it: its name in the
 * adapter's config, and the canonical-to-adapter refName map. A feature off the
 * wire carries these spellings, so this is what finds its slice.
 */
export interface AdapterNames {
  assemblyName: string
  refNameMap: Record<string, string>
}

export interface ChordFetchArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  /** the displayed regions on the track's assemblies, canonical */
  regions: Region[]
  /** the track's assemblies on the circle, canonical, in circle order */
  assemblyNames: string[]
}

// The host's config, narrowed to the slot this base reads: `getConf` checks a
// name against the schema of the model it is handed, so reaching the host
// through the widened `AnyConfigurationModel` would check nothing.
interface ChordConfigHost {
  configuration: ChordConfigModel
}

const confNode = (self: object) => self as ChordConfigHost

function sliceKey(assemblyName: string | undefined, refName: string) {
  return `${assemblyName ?? ''}\u0000${refName}`
}

/**
 * #stateModel BaseChordDisplay
 *
 * What the circular view's chord and ribbon displays share: the features and the
 * per-assembly name tables that place them, the slice index a feature end is
 * looked up in, and the lifecycle getters `ChordDisplayFrame` publishes. A track
 * draws on the arcs of its own assemblies, so a one-genome variant track on a
 * two-genome circle fetches and places only that genome's chords.
 */
export function BaseChordDisplay() {
  return types
    .compose('BaseChordDisplay', BaseDisplay, types.model({}))
    .volatile(() => ({
      /**
       * #volatile
       */
      features: undefined as Feature[] | undefined,
      /**
       * #volatile
       * one entry per assembly of the track on the circle, keyed by canonical
       * name
       */
      adapterNames: undefined as Record<string, AdapterNames> | undefined,
      /**
       * #volatile
       * the fetch's pure "go again" signal
       */
      reloadCounter: 0,
      /**
       * #volatile
       * ids of the features to keep at full strength while the rest dim;
       * undefined dims nothing. The SV inspector writes the selected record's
       * event here
       */
      highlightedFeatureIds: undefined as string[] | undefined,
      /**
       * #volatile
       * ids of the features to draw; undefined draws them all. The SV
       * inspector writes the rows its sheet's filters leave here, so a filter
       * change is a redraw and no refetch
       */
      visibleFeatureIds: undefined as string[] | undefined,
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
       * the track's assemblies that are on the circle, canonical and in the
       * order the circle lays them out
       */
      get trackAssemblyNames() {
        const { assemblyManager } = getSession(self)
        const names = getConfAssemblyNamesOrNone(
          getContainingTrack(self).configuration,
        )
        return this.view.assemblyNames.filter(name =>
          names.some(t => isSameAssemblyName(t, name, assemblyManager)),
        )
      },
      /**
       * #getter
       * nothing of this track's is on the circle, so the fetch never runs; the
       * SVG export's wait and the retry contract check both read it
       */
      get fetchInert() {
        return !this.view.displayedRegions.some(r =>
          this.trackAssemblyNames.includes(r.assemblyName),
        )
      },
      /**
       * #getter
       * both halves of a draw have arrived: the features and the name tables
       * that place their ends
       */
      get loaded() {
        return self.features !== undefined && self.adapterNames !== undefined
      },
      /**
       * #getter
       */
      get ready() {
        return this.loaded
      },
      /**
       * #getter
       * what the error ring shows
       */
      get displayError(): unknown {
        return self.error
      },
      /**
       * #getter
       * the off-screen export gate, on the shared `computeSvgReady` policy. A
       * radial display has no box to draw an error in, so the export fails
       * rather than exporting a message
       */
      get svgReady() {
        return computeSvgReady(
          {
            error: this.displayError,
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
          { regionTooLarge: false, error: this.displayError },
          () => (!this.fetchInert && !this.ready ? 'loading' : 'ready'),
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
       * how deep a chord bows toward the center, as a fraction of the radius;
       * one straight across the circle reaches it, a shorter one bows in
       * proportion to its span
       */
      get bezierRadiusRatio(): number {
        return getConf(confNode(self), 'bezierRadiusRatio')
      },
      /**
       * #getter
       */
      get bezierRadius() {
        return this.radiusPx * this.bezierRadiusRatio
      },
      /**
       * #getter
       * every slice of the circle, keyed by the assembly AND refName a feature
       * off this display's adapter carries. Both halves are needed: two genomes
       * on one circle can each carry a `chr1`. An elided slice answers to each
       * refName it swallowed.
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
       * what the chord components draw: `features`, narrowed to
       * `visibleFeatureIds`
       */
      get drawnFeatures() {
        const visible = self.visibleFeatureIds
          ? new Set(self.visibleFeatureIds)
          : undefined
        return visible
          ? self.features?.filter(f => visible.has(f.id()))
          : self.features
      },
      /**
       * #getter
       */
      get highlightedFeatureIdSet() {
        return self.highlightedFeatureIds
          ? new Set(self.highlightedFeatureIds)
          : undefined
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
    .views(self => ({
      /**
       * #method
       * the slice one end of a feature lands on. A feature that names no
       * assembly, as a VCF record does not, is on the track's first assembly.
       */
      sliceFor(assemblyName: string | undefined, refName: string) {
        const [first] = self.trackAssemblyNames
        const spelled =
          assemblyName ??
          (first === undefined
            ? undefined
            : (self.adapterNames?.[first]?.assemblyName ?? first))
        return self.sliceIndex[sliceKey(spelled, refName)]
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      openErrorDialog() {
        getDialogHost(self).queueDialog(onClose => [
          ErrorMessageStackTraceDialog,
          { onClose, error: self.displayError },
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
      setHighlightedFeatureIds(ids: string[] | undefined) {
        self.highlightedFeatureIds = ids
      },
      /**
       * #action
       */
      setVisibleFeatureIds(ids: string[] | undefined) {
        self.visibleFeatureIds = ids
      },
      /**
       * #action
       */
      reload() {
        self.setError(undefined)
        self.reloadCounter += 1
      },
    }))
}

export interface BaseChordDisplayModel extends Instance<
  ReturnType<typeof BaseChordDisplay>
> {}

/**
 * A chord display's one fetch: the features `fetchFeatures` brings back over
 * the track's regions, and the name tables, together, since a draw needs both
 * and they share one `error` slot. Keyed on the region set ignoring order and
 * `reversed`, because the slice index re-places features and a reorder only
 * moves and flips regions.
 */
export function installChordFetch(
  self: BaseChordDisplayModel,
  {
    name,
    fetchFeatures,
  }: {
    name: string
    fetchFeatures: (
      args: ChordFetchArgs,
      ctx: FetchContext,
    ) => Promise<Feature[]>
  },
) {
  installFetch(self, {
    name,
    delay: 300,
    report: self,
    contract: `${name} chord fetch`,
    prepare: () => {
      const { view, trackAssemblyNames } = self
      const regions = view.displayedRegions.filter(r =>
        trackAssemblyNames.includes(r.assemblyName),
      )
      return regions.length
        ? {
            sessionId: getRpcSessionId(self),
            adapterConfig: structuredClone(self.adapterConfig),
            regions: structuredClone(regions),
            assemblyNames: [...trackAssemblyNames],
          }
        : undefined
    },
    fetchKey: ({ adapterConfig, regions, assemblyNames }) => ({
      adapterConfig,
      assemblyNames,
      regions: regions
        .map(r => `${r.assemblyName}:${r.refName}:${r.start}-${r.end}`)
        .sort(),
    }),
    run: async (args, ctx) => {
      const { sessionId, adapterConfig, assemblyNames } = args
      const { assemblyManager } = getSession(self)
      const spelled = regionsInAssemblyNamespace(
        assemblyNames.map(assemblyName => ({ assemblyName })),
        adapterAssemblyNames(adapterConfig),
        assemblyManager,
      )
      const [featCtx, mapCtx] = fanOutStatus(ctx, 2)
      const [features, maps] = await Promise.all([
        fetchFeatures(args, featCtx!),
        Promise.all(
          assemblyNames.map(async (assemblyName, i) => {
            const refNameMap = await assemblyManager.getRefNameMapForAdapter(
              adapterConfig,
              assemblyName,
              {
                signal: mapCtx!.signal,
                sessionId,
                statusCallback: mapCtx!.statusCallback,
              },
            )
            return [
              assemblyName,
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
    // freshness is `loaded` alone, so a stale half left in place would read as
    // current and the old tables name the previous regions' contigs
    onBegin: () => {
      self.setAdapterNames(undefined)
      self.setFeatures(undefined)
    },
    setError: error => {
      self.setError(error)
    },
  })
}

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
import { installFetch } from '@jbrowse/core/util/installFetch'
import {
  getConfAssemblyNamesOrNone,
  getRpcSessionId,
  isSameAssemblyName,
} from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import { computeDisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

import { sliceKey } from './chordStage.ts'

import type { CircularViewModel } from '../CircularView/model.ts'
import type { Slice } from '../CircularView/slices.ts'
import type { ChordConfigModel } from './chordConfigSchemaFields.ts'
import type { AxisSlice, ChordStage } from './chordStage.ts'
import type { Feature } from '@jbrowse/core/util'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { Region } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

const ErrorMessageStackTraceDialog = lazy(
  () => import('@jbrowse/core/ui/ErrorMessageStackTraceDialog'),
)

export interface ChordFetchArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  /** the displayed regions on the track's assemblies, canonical */
  regions: Region[]
}

// The host's config, narrowed to the slot this base reads: `getConf` checks a
// name against the schema of the model it is handed, so reaching the host
// through the widened `AnyConfigurationModel` would check nothing.
interface ChordConfigHost {
  configuration: ChordConfigModel
}

const confNode = (self: object) => self as ChordConfigHost

/**
 * #stateModel BaseChordDisplay
 *
 * What the circular view's chord and ribbon displays share: the features, the
 * slice index a feature end is looked up in, and the lifecycle getters
 * `ChordDisplayFrame` publishes. A track
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
       */
      get loaded() {
        return self.features !== undefined
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
       * how far from the center a chord across the circle passes, as a
       * fraction of the radius; a shorter chord bows less, in proportion to its
       * span
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
       * every slice of the circle, keyed by canonical assembly AND refName: two
       * genomes on one circle can each carry a `chr1`. An elided slice answers
       * to each refName it swallowed.
       */
      get sliceIndex(): Record<string, Slice> {
        const result: Record<string, Slice> = {}
        for (const block of this.view.staticSlices) {
          const regions = block.region.elided
            ? block.region.regions
            : [block.region]
          for (const region of regions) {
            result[sliceKey(region.assemblyName, region.refName)] = block
          }
        }
        return result
      },
      /**
       * #getter
       * `features`, narrowed to `visibleFeatureIds`
       */
      get visibleFeatures() {
        const visible = self.visibleFeatureIds
          ? new Set(self.visibleFeatureIds)
          : undefined
        return visible
          ? self.features?.filter(f => visible.has(f.id()))
          : self.features
      },
      /**
       * #getter
       * what the chord components draw
       */
      get drawnFeatures(): Feature[] | undefined {
        return this.visibleFeatures
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
      /**
       * #getter
       * the feature under the pointer, which the view resolves off its pick
       * canvas for every chord display at once
       */
      get hoveredFeatureId() {
        const hover = this.view.chordHover
        return hover?.display.id === self.id ? hover.feature.id() : undefined
      },
      /**
       * #getter
       * the polar stage as the canvas and the pointer see it, rotation in
       */
      get chordStage(): ChordStage {
        return { ...this.figureStage, offsetRadians: this.view.offsetRadians }
      },
      /**
       * #getter
       * the polar stage on the unrotated figure, which the view's SVG turns:
       * what the export and the highlight paths are placed on
       */
      get figureStage(): ChordStage {
        const { radiansPerBp, gapRadians } = this.view.chordScale
        return {
          radiansPerBp,
          gapRadians,
          offsetRadians: 0,
          radiusPx: this.radiusPx,
          bezierRadiusPx: this.bezierRadius,
        }
      },
    }))
    .views(self => ({
      /**
       * #method
       * the assembly on the circle a feature names, in whatever spelling the
       * adapter wrote. A feature that names none, as a VCF record does not, is
       * on the track's first assembly.
       */
      assemblyOf(assemblyName: string | undefined) {
        const { assemblyManager } = getSession(self)
        return assemblyName === undefined
          ? self.trackAssemblyNames[0]
          : self.view.assemblyNames.find(name =>
              isSameAssemblyName(name, assemblyName, assemblyManager),
            )
      },
      /**
       * #method
       * a refName as the adapter wrote it, in the assembly's canonical spelling
       */
      canonicalRefName(assemblyName: string, refName: string) {
        return (
          getSession(self)
            .assemblyManager.get(assemblyName)
            ?.getCanonicalRefName2(refName) ?? refName
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       * the slice one end of a feature lands on
       */
      sliceFor(assemblyName: string | undefined, refName: string) {
        const assembly = self.assemblyOf(assemblyName)
        return assembly === undefined
          ? undefined
          : self.sliceIndex[
              sliceKey(assembly, self.canonicalRefName(assembly, refName))
            ]
      },
      /**
       * #method
       * the slice of the unrolled axis one end of a feature lands on
       */
      axisSlice(
        assemblyName: string | undefined,
        refName: string,
      ): AxisSlice | undefined {
        const assembly = self.assemblyOf(assemblyName)
        return assembly === undefined
          ? undefined
          : self.view.chordAxis.byKey.get(
              sliceKey(assembly, self.canonicalRefName(assembly, refName)),
            )
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
 * the track's regions. Keyed on the region set ignoring order and `reversed`,
 * because the slice index re-places features and a reorder only moves and flips
 * regions.
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
          }
        : undefined
    },
    fetchKey: ({ adapterConfig, regions }) => ({
      adapterConfig,
      regions: regions
        .map(r => `${r.assemblyName}:${r.refName}:${r.start}-${r.end}`)
        .sort(),
    }),
    run: fetchFeatures,
    commit: features => {
      self.setFeatures(features)
    },
    onBegin: () => {
      self.setFeatures(undefined)
    },
    setError: error => {
      self.setError(error)
    },
  })
}

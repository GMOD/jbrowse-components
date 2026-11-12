import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { overByteBudget } from '@jbrowse/core/rpc/byteBudget'
import { computeSvgReady } from '@jbrowse/core/svg/svgReady'
import {
  getContainingView,
  getDialogHost,
  getSession,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { installFetch } from '@jbrowse/core/util/installFetch'
import { getRpcSessionId, isSameAssemblyName } from '@jbrowse/core/util/tracks'
import RegionTooLargeMixin from '@jbrowse/display-kit/RegionTooLargeMixin'
import { onTrackAssembly } from '@jbrowse/display-kit/foundationView'
import { openGateCommit } from '@jbrowse/display-kit/gateCommit'
import { types } from '@jbrowse/mobx-state-tree'
import { computeDisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

import { sliceKey } from '../CircularView/slices.ts'
import { figurePoint } from './chordStage.ts'
import { shapePath } from './shapePath.ts'

import type { CircularViewModel } from '../CircularView/model.ts'
import type { AxisSlice } from '../CircularView/slices.ts'
import type { ChordConfigModel } from './chordMarkConfigSchema.ts'
import type { ChordStage } from './chordStage.ts'
import type { Shape } from './shapes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { Region } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

const ErrorMessageStackTraceDialog = lazy(
  () => import('@jbrowse/core/ui/ErrorMessageStackTraceDialog'),
)

const NO_LANES = { count: 0, features: [] as readonly Feature[] }

/** One end of a feature on the circle, as `placeEnd` resolves it. */
export interface PlacedEnd {
  assemblyName: string | undefined
  refName: string
}

export interface ChordFetchArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  /** the displayed regions on the track's assemblies, canonical */
  regions: Region[]
  /** what the whole fetch may download, undefined where the gate may not act */
  byteLimit: number | undefined
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
 * #category display
 *
 * What the circular view's chord and ribbon displays share: the features, the
 * slice index a feature end is looked up in, the lifecycle getters
 * `ChordDisplayFrame` publishes, and the linear displays' region-too-large
 * gate, which a display opts into with `gateEnabled`. A track
 * draws on the arcs of the assemblies it names, so a one-genome variant track
 * on a two-genome circle fetches and places only that genome's chords.
 */
export function BaseChordDisplay() {
  return types
    .compose(
      'BaseChordDisplay',
      BaseDisplay,
      RegionTooLargeMixin(),
      types.model({}),
    )
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
        return this.view.assemblyNames.filter(onTrackAssembly(self))
      },
      /**
       * #getter
       * the displayed regions on the track's assemblies
       */
      get trackRegions() {
        return this.view.displayedRegions.filter(r =>
          this.trackAssemblyNames.includes(r.assemblyName),
        )
      },
      /**
       * #getter
       * nothing of this track's is on the circle, so the fetch never runs; the
       * SVG export's wait and the retry contract check both read it
       */
      get fetchInert() {
        return this.trackRegions.length === 0
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
       * a chord fetch takes no settings, so the gate's measurement is about
       * the regions alone
       */
      get settingsFetchInputs() {
        return {}
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
            regionTooLarge: self.regionTooLarge,
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
          { regionTooLarge: self.regionTooLarge, error: this.displayError },
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
       * `mark.depth`, how deeply a chord curves toward the center, 0 to 1
       */
      get curveDepth(): number {
        return getConf(confNode(self), ['mark', 'depth'])
      },
      /**
       * #getter
       * the radius of a chord's Bezier control point when its ends are
       * opposite each other
       */
      get bezierRadius() {
        return this.radiusPx * (1 - this.curveDepth)
      },
      /**
       * #getter
       * the feature under the pointer, which the view hit-tests for every
       * chord display at once
       */
      get hoveredFeatureId() {
        const hover = this.view.hoveredChord
        return hover?.display.id === self.id ? hover.feature.id() : undefined
      },
      /**
       * #getter
       * the polar stage on the unrotated figure, which the view's SVG turns:
       * what the export, the highlight paths and the hit tests are placed on
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
    .views(() => ({
      /**
       * #getter
       * Overridable hook: the drawn records, one per lane, in paint order
       */
      get drawnLanes(): { count: number; features: readonly Feature[] } {
        return NO_LANES
      },
      /**
       * #method
       * Overridable hook: lane `i` as the SVG side draws it, on the unrotated
       * figure; undefined where it draws nothing
       */
      shapeAt(_i: number): Shape | undefined {
        return undefined
      },
      /**
       * #method
       * Overridable hook: the topmost lane under a point on the unrotated
       * figure
       */
      laneAt(_x: number, _y: number): number | undefined {
        return undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * each drawn record's lane, by id
       */
      get laneIndexById(): ReadonlyMap<string, number> {
        return new Map(self.drawnLanes.features.map((f, i) => [f.id(), i]))
      },
      /**
       * #getter
       * how many lanes the canvas draws, a chord under a pixel included
       */
      get drawnCount() {
        return self.drawnLanes.count
      },
    }))
    .views(self => ({
      /**
       * #method
       * the shape a drawn record's id names, undefined where none draws
       */
      shapeFor(featureId: string) {
        const i = self.laneIndexById.get(featureId)
        return i === undefined ? undefined : self.shapeAt(i)
      },
      /**
       * #getter
       * every drawn shape, as the export draws it
       */
      get shapes(): Shape[] {
        const out: Shape[] = []
        for (let i = 0; i < self.drawnLanes.count; i++) {
          const shape = self.shapeAt(i)
          if (shape) {
            out.push(shape)
          }
        }
        return out
      },
      /**
       * #method
       * a drawn feature's outline as an SVG path on the unrotated figure, for
       * anything that has to find a shape on screen without a DOM node
       */
      shapePathFor(feature: Feature) {
        const shape = this.shapeFor(feature.id())
        return shape
          ? shapePath(shape, self.radiusPx, self.bezierRadius)
          : undefined
      },
      /**
       * #method
       * the record drawn under a point CSS px from the circle's centre in the
       * screen frame
       */
      hitAt(dx: number, dy: number) {
        if (self.displayPhase !== 'ready') {
          return undefined
        }
        const [x, y] = figurePoint(dx, dy, self.view.offsetRadians)
        const i = self.laneAt(x, y)
        return i === undefined ? undefined : self.drawnLanes.features[i]
      },
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
       * one end of a feature, as the adapter wrote it, on the circle: the
       * assembly it names (`assemblyOf`) and its refName in that assembly's
       * spelling, the assembly undefined where it names none on the circle
       */
      placeEnd(assemblyName: string | undefined, refName: string): PlacedEnd {
        const assembly = self.assemblyOf(assemblyName)
        return {
          assemblyName: assembly,
          refName:
            assembly === undefined
              ? refName
              : self.canonicalRefName(assembly, refName),
        }
      },
      /**
       * #method
       * the slice of the unrolled axis a placed end falls in
       */
      axisSlice({ assemblyName, refName }: PlacedEnd): AxisSlice | undefined {
        return assemblyName === undefined
          ? undefined
          : self.view.chordAxis.byKey.get(sliceKey(assemblyName, refName))
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
       * what a click on the canvas reaches: the record's details
       */
      clickFeature(feature: Feature) {
        openFeatureWidget(self, feature.toJSON(), {
          widget: self.featureWidgetType,
          feature,
        })
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
 * regions, and on the byte limit, so a force load refetches.
 *
 * Where the gate may act, the index's estimate of the whole fetch comes first
 * and a fetch over the limit downloads nothing. The whole request rather than
 * the largest region, as a track save measures it: the circle holds every
 * region's records at once.
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
      const regions = self.trackRegions
      return regions.length
        ? {
            sessionId: getRpcSessionId(self),
            adapterConfig: structuredClone(self.adapterConfig),
            regions: structuredClone(regions),
            byteLimit: self.resolvedByteLimit(),
          }
        : undefined
    },
    fetchKey: ({ adapterConfig, regions, byteLimit }) => ({
      adapterConfig,
      byteLimit,
      regions: regions
        .map(r => `${r.assemblyName}:${r.refName}:${r.start}-${r.end}`)
        .sort(),
    }),
    run: async (args, ctx) => {
      const gate = openGateCommit(self)
      const { adapterConfig, regions, byteLimit } = args
      const bytes =
        byteLimit === undefined
          ? undefined
          : await ctx.callRpc('CoreGetRegionByteEstimate', {
              adapterConfig,
              regions,
              scope: 'wholeRequest',
            })
      gate.commit({ perRegionBytes: [bytes], partial: false })
      return overByteBudget(bytes, byteLimit)
        ? undefined
        : fetchFeatures(args, ctx)
    },
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

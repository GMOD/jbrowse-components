import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { computeSvgReady } from '@jbrowse/core/svg/svgReady'
import {
  findParentThatIs,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { sharedBackendKey } from '@jbrowse/render-core/installKeyedLifecycle'
import {
  NO_CIGAR_OPS,
  SyntenyFetchStateMixin,
  bucketBpPerPx,
  comparativeDisplayPhase,
  featureAttributes,
  getCoarseBpPerPxThreshold,
  isDataCurrent,
  regionSignature,
  resolveLodTier,
  swappedAssembliesWarning,
  syntenyFetchRegions,
} from '@jbrowse/synteny-core'

import { offscreenMateTally } from '../LinearSyntenyRPC/collectOffscreenMates.ts'
import { computePresentCigarKinds } from '../LinearSyntenyRPC/presentCigarKinds.ts'
import { computeSyntenyColors } from '../LinearSyntenyRPC/syntenyColors.ts'
import { cappedMeanWidthPx } from '../LinearSyntenyView/fadeThin.ts'
import { isSyntenyLevel } from '../LinearSyntenyViewHelper/parentViewDuck.ts'
import { getCigarOpAtInstance, getTooltipLines } from './components/util.ts'

import type { SyntenyGeometry } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { ClickCoord } from './components/util.ts'
import type { LinearSyntenyDisplayConfigSchema } from './configSchemaF.ts'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'
import type {
  AttributeRange,
  CigarOpMask,
  LodTier,
  SyntenyColorBy,
} from '@jbrowse/synteny-core'

export interface SyntenyFeatureData {
  strands: Int8Array
  starts: Uint32Array
  ends: Uint32Array
  // Every numeric channel a continuous color-by mode can paint, keyed by
  // attribute name. Holds the four presets — `identity`, `meanIdentity`,
  // `mappingQual`, and the derived `dnds` — plus whatever columns the track
  // declares, so switching between them recolors on the main thread with no
  // refetch. Float32 with -1 for missing, which is why there is no valid bitmap.
  attributes: Record<string, Float32Array>
  // What each channel actually spanned, ignoring the -1s. The domain an
  // `attribute:<name>` mode scales to, and the numbers its legend is labelled
  // with; the presets have fixed domains and ignore this.
  attributeRanges: Record<string, AttributeRange>
  // Genuinely distinct per feature, so this one stays a `string[]`: a dictionary
  // of 500k distinct strings costs the same clone plus an index array. See
  // `makeStringDict`, which is also where the measurement lives.
  featureIds: string[]
  // The five per-feature string lanes that ARE worth dictionary-encoding, each
  // bounded by something other than the feature count — a gene symbol or nothing
  // (a PAF names no features), a scaffold count, and twice over the single
  // assembly this level draws. `getFeatureAtIndex` is the one place that reads
  // them, so the encoding stops there rather than spreading.
  nameDict: string[]
  nameIds: Uint32Array
  refNameDict: string[]
  refNameIds: Uint32Array
  assemblyNameDict: string[]
  assemblyNameIds: Uint32Array
  // Mate fields packed as parallel arrays. Uint32 buffers are RPC-transferable
  // and match the bp coord convention used elsewhere in the codebase.
  // mate.name was always undefined (no adapter sets it) so it's dropped.
  mateStarts: Uint32Array
  mateEnds: Uint32Array
  mateRefNameDict: string[]
  mateRefNameIds: Uint32Array
  mateAssemblyNameDict: string[]
  mateAssemblyNameIds: Uint32Array
  // True when at least one feature in this RPC response carried a CIGAR
  // string. Used to gate CIGAR-related menu items so they don't appear when
  // the resolved tier (coarse PIF, or a CIGAR-less PAF) has no per-row ops.
  hasCigar: boolean
  // The alignments this level FETCHED and could not draw a ribbon for, because
  // their mate is on a contig the facing row is not displaying. Counted per
  // contig and placed on the query axis. Not a subset of anything above: no
  // entry here has a row in the per-feature lanes.
  offscreenMates: OffscreenMateData
  // The same thing seen from the other row, and empty unless the view asked for
  // the second fetch: alignments anchored on a target-axis contig whose query
  // end is on a contig the row above is not displaying. The query-axis fetch
  // never requests these, so this is the one class the view cannot report from
  // one fetch. Placed on the TARGET axis.
  targetOffscreenMates: OffscreenMateData
}

export interface FeatPos {
  id: string
  strand: number
  name: string
  refName: string
  start: number
  end: number
  assemblyName: string
  mate: {
    start: number
    end: number
    refName: string
    assemblyName: string
  }
  // Every numeric channel this feature carried a value for, keyed by channel
  // name — not `identity` alone, which is what the tooltip and the feature
  // panel used to show while the fetch carried mapping quality, dN/dS and any
  // column the track declared. `featureAttributes` drops the -1 sentinel.
  attributes: Record<string, number>
}

function windowSignature(regions: Region[]) {
  return regions.map(r => `${r.refName}:${r.start}-${r.end}`).join(',')
}

// Exported for the synteny follow, which picks a feature by scanning the packed
// arrays itself and so holds a FEATURE index rather than the instance index
// `getFeature` below translates from.
export function getFeatureAtIndex(
  data: SyntenyFeatureData,
  i: number,
): FeatPos {
  return {
    id: data.featureIds[i]!,
    strand: data.strands[i]!,
    name: data.nameDict[data.nameIds[i]!]!,
    refName: data.refNameDict[data.refNameIds[i]!]!,
    start: data.starts[i]!,
    end: data.ends[i]!,
    assemblyName: data.assemblyNameDict[data.assemblyNameIds[i]!]!,
    mate: {
      start: data.mateStarts[i]!,
      end: data.mateEnds[i]!,
      refName: data.mateRefNameDict[data.mateRefNameIds[i]!]!,
      assemblyName: data.mateAssemblyNameDict[data.mateAssemblyNameIds[i]!]!,
    },
    attributes: featureAttributes(data.attributes, i),
  }
}

/**
 * #stateModel LinearSyntenyDisplay
 *
 * Pure-data model. The containing LinearSyntenyView owns the shared GPU
 * backend, the upload autorun (which watches every display's `instanceData`
 * and keys it by `displayKey`), and the render autorun. This display only
 * carries per-track state and the `renderParams` the view reads out.
 *
 * #example
 * A complete `SyntenyTrack` config to paste into `tracks`. The adapter needs
 * the query (first) and target (second) assembly names, matched by the track's
 * `assemblyNames`:
 * ```js
 * {
 *   type: 'SyntenyTrack',
 *   trackId: 'hg38_vs_mm10',
 *   name: 'hg38 vs mm10',
 *   assemblyNames: ['hg38', 'mm10'],
 *   adapter: {
 *     type: 'PAFAdapter',
 *     uri: 'https://example.com/hg38_vs_mm10.paf',
 *     queryAssembly: 'hg38',
 *     targetAssembly: 'mm10',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearSyntenyDisplay',
 *       displayId: 'hg38_vs_mm10-LinearSyntenyDisplay',
 *     },
 *   ],
 * }
 * ```
 */
function stateModelFactory(configSchema: LinearSyntenyDisplayConfigSchema) {
  return types
    .compose(
      'LinearSyntenyDisplay',
      BaseDisplay,
      SyntenyFetchStateMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearSyntenyDisplay'),
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
      featureData: undefined as SyntenyFeatureData | undefined,
      /**
       * #volatile
       * Raw GPU-instance geometry produced by the RPC. The view observes
       * this on every display and uploads it to the shared backend keyed by
       * `displayKey`. Clearing it (undefined) triggers backend eviction.
       */
      instanceData: undefined as SyntenyGeometry | undefined,
      /**
       * #volatile
       * Index into `instanceData` of the GPU instance the pointer is over, or
       * -1. The INSTANCE, not the feature, even though the tooltip and the
       * highlight are both about the feature: a CIGAR-detailed ribbon is a base
       * block plus a tile per indel, and the operator under the cursor is
       * readable from nothing else (`getCigarOpAtInstance`). `getFeature`
       * translates to the feature. Same choice `DotplotDisplay` makes, where
       * the stored index is `hoveredSegmentIdx`.
       */
      hoveredInstanceIdx: -1,
      /**
       * #volatile
       * Clicked twin of `hoveredInstanceIdx` — the instance whose feature stays
       * highlighted after the pointer leaves it.
       */
      clickedInstanceIdx: -1,
      contextMenuAnchor: undefined as ClickCoord | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       * Set both feature and instance data in one MST action so downstream
       * autoruns (upload, render) fire once per RPC completion, not twice.
       *
       * The hover/click indices address the OUTGOING instanceData, so they are
       * meaningless against the incoming arrays and must be dropped here — a
       * surviving index either highlights an unrelated ribbon (still in range)
       * or writes NaN into the clickedFeatureId uniform (out of range). A
       * refetch is a zoom/pan/mode change, after which the pointer is no longer
       * over whatever it was hovering anyway.
       *
       * An open context menu goes with them, for the same reason one step
       * further along. It does not hold an index — it holds a resolved feature
       * and the window a panel was showing — but both describe the fetch that
       * has just been replaced, and its items act on them ASYNCHRONOUSLY, after
       * a click. Feature ids are not comparable across a tiered PIF's two
       * tiers, so a menu that outlived a tier flip would ask the worker to
       * resolve an id the new tier does not have, and get back the same
       * `undefined` a CIGAR-less block gives — which is what
       * `moveMatchingPanel` then reports it as.
       */
      setRpcData(
        featureData: SyntenyFeatureData | undefined,
        instanceData: SyntenyGeometry | undefined,
        fetchKey: string,
      ) {
        self.featureData = featureData
        self.instanceData = instanceData
        self.loadedFetchKey = fetchKey
        self.hoveredInstanceIdx = -1
        self.clickedInstanceIdx = -1
        self.contextMenuAnchor = undefined
      },
      /**
       * #action
       * Point the hover at one GPU instance, or -1 for none. The level's
       * `setHoveredFeature` is what calls this, from a pick hit.
       */
      setHoveredInstanceIdx(idx: number) {
        self.hoveredInstanceIdx = idx
      },
      /**
       * #action
       */
      setClickedInstanceIdx(idx: number) {
        self.clickedInstanceIdx = idx
      },
      openContextMenu(anchor: ClickCoord) {
        self.contextMenuAnchor = anchor
      },
      closeContextMenu() {
        self.contextMenuAnchor = undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The level (row gap) this display's track sits on. Found by predicate
       * rather than by hop count — see isSyntenyLevel.
       */
      get parentHelper() {
        return findParentThatIs(self, isSyntenyLevel)
      },
      /**
       * #getter
       * Index of the level (row gap) this display draws in: between
       * `view.views[level]` and `view.views[level + 1]`.
       */
      get level() {
        return this.parentHelper.level
      },
      /**
       * #getter
       * Stable backend key under the view-shared backend.
       */
      get displayKey() {
        return sharedBackendKey(self.id)
      },
      /**
       * #getter
       */
      get height() {
        return this.parentHelper.height
      },
      /**
       * #getter
       * The track's adapter config verbatim. The **body and return type are now
       * identical to `BaseDisplayModel.adapterConfig`** — this override survives
       * only to hold the note below where someone would go to re-add a key.
       *
       * Byte-identical is the point: the worker's adapter cache keys on the
       * config object, so a key the adapter never reads still forks the cache.
       * The two decorative keys this used to add — `name`, duplicating the
       * adapter's own `type`, and `assemblyNames`, read off the display's
       * config schema, which declares no such slot and so always answered
       * `undefined` — bought a second parse of the same file: one adapter for
       * the ribbons and another for everything reading the track plainly
       * (LGVSyntenyDisplay, the region launch's mate discovery). Both keys were
       * inert at the adapter, which is exactly why nothing caught it. A
       * worker-side value that doesn't belong to the adapter goes as a sibling
       * RPC arg, the way `sequenceAdapter` does.
       */
      get adapterConfig(): Record<string, unknown> {
        // Body and annotation are both identical to `BaseDisplay`'s now that the
        // base is annotated too, so this override survives only to hold the note
        // above at the spot someone would edit. `DotplotDisplay` had the same
        // override for the annotation alone, and it is gone.
        return getConf(self.parentTrack, 'adapter')
      },
      /**
       * #getter
       */
      get numFeats() {
        return self.featureData?.featureIds.length ?? 0
      },
      /**
       * #getter
       * The contigs this level fetched alignments to but cannot draw a ribbon
       * for, largest first, because the facing row is not displaying them.
       *
       * A getter rather than shipped as objects: the tally is one entry per
       * contig, so sorting it is over a scaffold count, while the lanes it is
       * built from are one entry per contig too. What the reader is shown, and
       * what names the rows worth offering to add.
       */
      get offscreenMateTally() {
        const { featureData } = self
        return featureData ? offscreenMateTally(featureData.offscreenMates) : []
      },
      /**
       * #getter
       * The same, for the row below: contigs of the QUERY assembly that the row
       * above is not displaying, which alignments anchored on the target axis
       * run to. Always empty without the bidirectional fetch, since those
       * alignments are never requested.
       */
      get targetOffscreenMateTally() {
        const { featureData } = self
        return featureData
          ? offscreenMateTally(featureData.targetOffscreenMates)
          : []
      },
      /**
       * #getter
       * Mean on-screen width (px, axis 0) of this display's alignment blocks with
       * every already-wide block counted as `FADE_WIDE_BLOCK_PX`, or 0 until a
       * fetch lands and both views connect. The fade only affects sub-pixel
       * ribbons (perpW < 1), so a capped mean well under 1 means the view is
       * dominated by thin ribbons — exactly what width-proportional fade
       * declutters, and `LinearSyntenyView.fadeThinAlignments` decides 'auto' off
       * the narrowest of these.
       *
       * O(numFeats) per zoom rather than per fetch, because the cap is a px
       * width: 4.2 ms over a million-block whole-genome PAF, where the answer is
       * nowhere near the threshold anyway, and 0.4 ms at a hundred thousand.
       */
      get cappedMeanAlignmentPx() {
        const { featureData } = self
        const connected = this.connectedViews
        return featureData && connected && connected.v0.width > 0
          ? cappedMeanWidthPx(
              featureData.starts,
              featureData.ends,
              connected.v0.bpPerPx,
            )
          : 0
      },
      /**
       * #getter
       * Which CIGAR indel ops are actually painted in the current geometry.
       * The worker only emits an indel instance for an op wide enough to draw
       * (sub-pixel indels are dropped), so a set bit means a visible-width op
       * of that kind is on screen. The legend keys its indel chips off this
       * rather than the coarse "file has any CIGAR" flag, so whole-genome zoom
       * (every indel sub-pixel) shows no dead insertion/deletion swatch.
       */
      get presentCigarKinds(): CigarOpMask {
        const { instanceData } = self
        return instanceData
          ? computePresentCigarKinds(
              instanceData.kinds,
              instanceData.instanceCount,
            )
          : NO_CIGAR_OPS
      },
      /**
       * #getter
       * Warnings surfaced in the view header. Flags a likely reversed assembly
       * row order, detected once at view load (only when the two assemblies have
       * distinct chromosome names).
       */
      get warnings() {
        return self.assembliesSwapped
          ? [
              swappedAssembliesWarning(
                'The chromosome names in the file match the opposite row. Try re-opening the synteny import form with the assemblies in the opposite order.',
              ),
            ]
          : []
      },
      /**
       * #getter
       * A fetch has completed (data is present, even if it mapped zero
       * features). Not `numFeats > 0` — an empty-but-finished fetch is ready,
       * otherwise an empty result spins the loading overlay forever.
       */
      get ready() {
        return self.featureData !== undefined
      },
      /**
       * #getter
       * Overrides `SyntenyFetchStateMixin`'s default-false hook with the two
       * states where this display's fetch autorun deliberately never runs:
       * minimized, or a level whose two rows aren't both showing regions. A
       * display in one of them draws nothing (`renderParams` is undefined for
       * exactly the same pair) and has no data coming, so anything waiting on
       * data has to treat it as terminal rather than wait forever. One getter
       * because four places answer it — the autorun's own gate, the loading
       * overlay, the SVG export, and (through the mixin) `displaysSettled`.
       */
      get fetchInert() {
        return self.isMinimized || !this.connectedViews
      },
      /**
       * #getter
       * First load: no data has arrived yet. Deliberately not `&& fetching` —
       * that would blink the overlay off during the pre-fetch debounce gap.
       * Excludes error so error UI and loading UI never show simultaneously,
       * and `fetchInert` so a display that will never fetch shows no overlay
       * instead of spinning on data that is not coming.
       * Drives the full striped LoadingOverlay.
       */
      get loading() {
        return !this.ready && !self.error && !this.fetchInert
      },
      /**
       * #getter
       * Refetch in-flight: a new fetch is running but stale ribbons are still
       * on screen (e.g. zoom-out across a log2 bucket, region change). Drives a
       * subtle corner indicator instead of the full overlay so the visible
       * ribbons aren't masked on every viewport change.
       */
      get refetching() {
        return self.fetching && this.ready && !self.error
      },
      /**
       * #getter
       * Contents, order and orientation of both connected views' displayed
       * regions — the inputs the worker's cumBp index is built from, so a change
       * in any of them makes held features stale. Its own getter, not inlined
       * into `currentFetchKey`: this is O(total regions) (a whole-genome view of
       * a scaffold-heavy assembly runs to thousands), while `currentFetchKey`'s
       * other deps flip on every pan past the buffer and every zoom bucket. Split
       * out, MobX memoizes it against `displayedRegions` alone instead of
       * rebuilding the whole string per zoom step.
       */
      get regionSignature() {
        const connected = this.connectedViews
        return connected
          ? [connected.v0, connected.v1]
              .map(v => regionSignature(v.displayedRegions))
              .join('_')
          : ''
      },
      /**
       * #getter
       * Fetch-input signature (region set/order, snapped fetch window, zoom
       * bucket, CIGAR draw options, LOD tier) for the view's current
       * state — the same tracked deps the fetch autorun refetches on. Reactive:
       * flips the instant any of them changes. Before both connected views are
       * ready it collapses to a degenerate signature (empty region sig, no
       * fetch-window/zoom keys) that no connected fetch can produce — a real
       * fetch requires non-empty displayedRegions — so `dataCurrent` reads false
       * until a real fetch lands. Non-nullable so it mirrors dotplot's.
       */
      get currentFetchKey(): string {
        const view = this.view
        return [
          this.fetchRegionsKey,
          this.bpPerPxBucketKey,
          this.regionSignature,
          // The CIGAR options and nothing else about how a ribbon is DRAWN:
          // these two gate the CIGAR parse, so they genuinely change what the
          // fetch brings back. `drawLocationMarkers` was here too, and it was
          // the odd one — markers need nothing from the adapter a plain fetch has
          // not already got, so ticking a checkbox for a purely visual grid
          // re-downloaded and re-parsed the whole track to arrive at the
          // identical features. The worker emits the ticks unconditionally now
          // and `computedColors` paints them transparent when the toggle is off,
          // which makes the toggle a color-lane patch through
          // `SYNTENY_INSTANCE_CACHE` — the same path colorBy takes to avoid an
          // RPC.
          view.drawCIGAR,
          view.drawCIGARMatchesOnly,
          // a second query per level, so it belongs here for the same reason the
          // CIGAR options do: it changes what comes back, not how it is drawn
          view.bidirectionalFetch,
          // the resolved tier, not view.lodMode: in 'auto' the mode is constant
          // while the tier flips, and the tier is what the fetch differs by
          this.lodTier,
        ].join('|')
      },
      /**
       * #getter
       * True when the rendered data was fetched for the view's current inputs.
       * Goes false the instant a region/zoom/draw-option change makes the held
       * ribbons stale — including during the pre-refetch debounce gap where
       * `fetching` is still false so `refetching` alone can't catch it.
       *
       * This is the shared freshness hook every display foundation answers,
       * expressed the signature-compare way (as arc and dotplot do); the
       * per-region families answer it with spatial coverage instead.
       */
      get dataCurrent(): boolean {
        return isDataCurrent(self.loadedFetchKey, this.currentFetchKey)
      },
      /**
       * #getter
       * Off-screen SVG export gate: "Export SVG" waits on this before drawing
       * (see the [SVG export guide](/docs/developer_guides/svg_export)). Synteny
       * is not an LGV display — it composes only `BaseDisplay` with its own
       * fetch — so it gets no mixin `svgReady`, but it runs the same shared
       * `computeSvgReady` policy so the two can't drift. Stale-safe on both
       * axes: `dataCurrent` closes the pre-refetch debounce gap (stale window
       * before `fetching` flips) and `!refetching` covers the in-flight RPC, so
       * an export fired right after a zoom/pan waits for fresh ribbons instead
       * of capturing stale ones. No `regionTooLarge` state (synteny never gates
       * on region size).
       *
       * `extraTerminal` is `fetchInert` — the states where the fetch autorun
       * deliberately never runs — so a data-only gate can't hang the export
       * forever on data that is never coming. `fetchCanceled` is terminal for
       * the same reason: durable until Retry, and an export presses nothing.
       */
      get svgReady() {
        return computeSvgReady(
          {
            error: self.error,
            regionTooLarge: false,
            extraTerminal: this.fetchInert,
            fetchCanceled: self.fetchCanceled,
          },
          () => this.ready && !this.refetching && this.dataCurrent,
        )
      },
      /**
       * #getter
       * The display's own mutually-exclusive state, the way every LGV display
       * publishes one — so `AppReadyMarker` counts this display's fetch, and the
       * app stops reporting itself ready over a ribbon that is still
       * working. Ranked by `comparativeDisplayPhase`, off the shared canvas's
       * `surfaceReadiness` and this display's own fetch state.
       *
       * `DisplayStatusPhase`, not `DisplayPhase`: the level owns the
       * rendering backend, so this display can never be the one to report a
       * backend failure.
       */
      get displayPhase(): DisplayStatusPhase {
        return comparativeDisplayPhase(
          {
            error: self.error,
            fetchInert: this.fetchInert,
            loading: this.loading,
            refetching: this.refetching,
            dataCurrent: this.dataCurrent,
          },
          this.parentHelper.surfaceReadiness,
        )
      },
      /**
       * #getter
       */
      get view() {
        return getContainingView(self) as LinearSyntenyViewModel
      },
      /**
       * #method
       * The parent feature under an INSTANCE index (what the pick engine and
       * the hover/click state carry). Without instanceData the two spaces
       * coincide. Deliberately not `instanceFeatureIdx[index] ?? index`: an
       * out-of-range instance index reads `undefined` there, and falling back to
       * the raw index would silently return a different feature rather than
       * nothing.
       */
      getFeature(index: number) {
        const { featureData, instanceData } = self
        if (!featureData) {
          return undefined
        }
        const featureIdx = instanceData
          ? instanceData.instanceFeatureIdx[index]
          : index
        if (
          featureIdx === undefined ||
          featureIdx < 0 ||
          featureIdx >= featureData.featureIds.length
        ) {
          return undefined
        }
        return getFeatureAtIndex(featureData, featureIdx)
      },
      /**
       * #getter
       * Main-thread-computed per-instance colors. Recomputes whenever
       * colorBy, featureData, or instanceData descriptors change — this is
       * the gpuProps half of the rpcProps/gpuProps split. colorBy changes
       * flow through here without touching the RPC.
       *
       * `drawLocationMarkers` rides the same lane, which is what keeps it out of
       * `currentFetchKey`: the worker always emits the ticks, and a zero alpha
       * here is what "off" means. So the toggle costs one color-lane patch
       * (`SYNTENY_INSTANCE_CACHE`) rather than a refetch of the whole track.
       */
      get computedColors() {
        const { instanceData, featureData } = self
        const { opacityByIdentity, drawLocationMarkers } = this.view
        if (!instanceData || !featureData) {
          return undefined
        }
        return computeSyntenyColors({
          instanceData,
          featureData,
          colorBy: this.effectiveColorBy,
          trackColor: this.trackColor,
          opacityByIdentity,
          drawLocationMarkers,
          nameOrder: this.paintedChromosomeOrder,
          attributeRanges: this.view.attributeRanges,
        })
      },
      /**
       * #getter
       * The chromosome order the chromosome-painting modes color by: the
       * refNames of whichever of this level's two assemblies `effectiveColorBy`
       * resolved to, in the assembly's own order. Undefined for every other
       * mode, and while the assembly is still loading — the color function
       * falls back to its hash there.
       *
       * It has to come from the assembly rather than from the features, because
       * a color must not change with which chromosomes happen to be in view.
       */
      get paintedChromosomeOrder(): readonly string[] | undefined {
        const colorBy = this.effectiveColorBy
        if (colorBy !== 'query' && colorBy !== 'target') {
          return undefined
        }
        const level = colorBy === 'query' ? this.level : this.level + 1
        const assemblyName = this.view.views[level]?.assemblyNames[0]
        return assemblyName === undefined
          ? undefined
          : getSession(self).assemblyManager.get(assemblyName)?.refNames
      },
      /**
       * #getter
       */
      get trackId(): string {
        return self.parentTrack.configuration.trackId
      },
      /**
       * #getter
       * This track's slot in the view's palette, used by `colorBy: 'track'`.
       * Assigned by the view, not locally: pinning a color on one track shifts
       * which automatic slots its siblings can take.
       */
      get trackColor(): string {
        return this.view.trackColorFor(this.trackId)
      },
      /**
       * #getter
       * The mode this track renders with, before the per-level 'reference'
       * remap: its own override if the user set one, else the view-wide mode.
       * This is the user-facing answer — menus and the legend title read it, so
       * a uniform 'reference' view reports 'reference' rather than the
       * query/target each level resolved it to.
       */
      get colorByMode(): SyntenyColorBy {
        return this.view.resolveColorBy(this.trackId)
      },
      /**
       * #getter
       * `colorByMode` resolved for this specific level, for the renderer.
       * 'reference' is a stacked-view mode that colors every level by the shared
       * anchor assembly's chromosome names; each level maps it to 'query' or
       * 'target' depending on which of its two assemblies is the anchor, so the
       * coloring stays consistent across levels. Every other mode passes
       * through.
       */
      get effectiveColorBy(): SyntenyColorBy {
        const colorBy = this.colorByMode
        if (colorBy === 'reference') {
          const { anchorAssemblyName: anchor, views } = this.view
          // this level draws between views[level] (query) and views[level+1]
          // (target); color by whichever side is the anchor so every level
          // keys on the same reference assembly's chromosome names
          const queryAsm = views[this.level]?.assemblyNames[0]
          const targetAsm = views[this.level + 1]?.assemblyNames[0]
          return targetAsm === anchor && queryAsm !== anchor
            ? 'target'
            : 'query'
        }
        return colorBy
      },
      /**
       * #getter
       * Instance data with main-thread-computed colors substituted in. The
       * view's upload autorun reads this, so any colorBy change re-fires
       * upload without an RPC round-trip.
       */
      get renderInstanceData() {
        const { instanceData } = self
        const colors = this.computedColors
        if (!instanceData || !colors) {
          return undefined
        }
        return { ...instanceData, colors }
      },
      /**
       * #getter
       * The hovered ribbon's tooltip, as lines, or undefined when nothing is
       * hovered. Lines rather than an HTML string — see `getTooltipLines`, and
       * `DotplotDisplay.tooltipLines` for the twin.
       */
      get tooltipLines(): string[] | undefined {
        const { hoveredInstanceIdx, instanceData } = self
        if (hoveredInstanceIdx < 0) {
          return undefined
        }
        const feat = this.getFeature(hoveredInstanceIdx)
        if (!feat) {
          return undefined
        }
        const cigarOp = instanceData
          ? getCigarOpAtInstance(instanceData, hoveredInstanceIdx)
          : undefined
        return getTooltipLines(feat, cigarOp)
      },
      /**
       * #getter
       * The two adjacent genome views this level draws between, or undefined
       * until both are initialized with regions. A level draws between an
       * adjacent pair, so both render and fetch depend only on those two views,
       * not the whole stack. Single source of truth for that gate.
       */
      get connectedViews() {
        const { views } = this.view
        const v0 = views[this.level]
        const v1 = views[this.level + 1]
        return this.view.initialized &&
          v0?.initialized &&
          v1?.initialized &&
          v0.displayedRegions.length > 0 &&
          v1.displayedRegions.length > 0
          ? { v0, v1 }
          : undefined
      },
      /**
       * #getter
       * Stable key over the log2 zoom bucket of both connected views. The
       * fetch autorun tracks this (a computed compares its string output)
       * instead of raw bpPerPx, so it only refetches when zoom crosses a
       * doubling rather than on every settled zoom within a bucket.
       */
      get bpPerPxBucketKey() {
        const connected = this.connectedViews
        return connected
          ? `${bucketBpPerPx(connected.v0.bpPerPx)}_${bucketBpPerPx(connected.v1.bpPerPx)}`
          : undefined
      },
      /**
       * #getter
       * The detail tier this level's fetch asks the adapter for, resolved here on
       * the main thread so it can enter `currentFetchKey`.
       *
       * It cannot be resolved adapter-side from `bpPerPx`: the refetch key carries
       * only `bpPerPxBucketKey`, a log2 bucket, and the default 10000 threshold
       * sits *inside* bucket 13 (8192..16384). Zooming across the threshold within
       * one bucket therefore changed nothing the key could see, and the view kept
       * drawing the coarse tier's gap-free ribbons while reporting itself current.
       *
       * The zoom fed in is `min` of both axes, because CIGAR detail is worth
       * drawing when the band is wide on EITHER axis — buildSyntenyGeometry's
       * MIN_CIGAR_PX_WIDTH gate uses `max(widthPx0, widthPx1)` — so dropping to
       * coarse is only safe once BOTH axes are past the threshold. Taking the
       * query axis alone lost indel detail on a band whose query was zoomed out
       * but whose target was zoomed in.
       */
      get lodTier(): LodTier {
        const connected = this.connectedViews
        // Nothing fetches before both views are ready; 'fine' is the neutral
        // answer there, and also what a non-tiered adapter resolves to.
        return connected
          ? resolveLodTier({
              bpPerPx: Math.min(connected.v0.bpPerPx, connected.v1.bpPerPx),
              coarseBpPerPxThreshold: getCoarseBpPerPxThreshold(
                self.parentTrack,
              ),
              lodMode: this.view.lodMode,
            })
          : 'fine'
      },
      /**
       * #getter
       * The query axis's (v0) fetch window, and the regions the fetch actually
       * sends: the visible content blocks expanded by the shared pan buffer and
       * snapped outward to a buffer-sized grid, so a pan within the buffer
       * neither refetches nor exposes an unfetched strip. The target axis is not
       * scoped — the fetch is one-dimensional (query regions in, every mate out)
       * — it only contributes its cumBp index, so it appears in
       * `fetchRegionsKey` but not here.
       */
      get fetchRegions() {
        const connected = this.connectedViews
        return connected ? syntenyFetchRegions(connected.v0) : []
      },
      /**
       * #getter
       * The target axis's (v1) fetch window, or [] unless the view asked for the
       * bidirectional fetch — in which case the worker queries it too, and
       * recovers the alignments anchored there whose query end is on a contig
       * the row above is not displaying. Empty is the signal, so the RPC
       * argument carries nothing when the setting is off.
       */
      get targetFetchRegions() {
        const connected = this.connectedViews
        return connected && this.view.bidirectionalFetch
          ? syntenyFetchRegions(connected.v1)
          : []
      },
      /**
       * #getter
       * Stable key over the *snapped* fetch window of both connected views. The
       * fetch autorun tracks this (through `currentFetchKey`) so a scroll/zoom
       * that moves either snapped window refetches, while a sub-buffer pan
       * (identical snapped windows) does not — a MobX computed only notifies
       * when its string output changes. Built from the same `fetchRegions` the
       * worker is handed, so the key can't describe a window the fetch didn't
       * use.
       */
      get fetchRegionsKey() {
        const connected = this.connectedViews
        return connected
          ? [this.fetchRegions, syntenyFetchRegions(connected.v1)]
              .map(windowSignature)
              .join('_')
          : undefined
      },
      /**
       * #getter
       * Per-track render params consumed by the view's aggregator. The view
       * substitutes yTop before handing this to the backend.
       */
      get renderParams() {
        // same spelling as the fetch autorun's gate, so "draws nothing" and
        // "never fetches" cannot come apart
        const connected = this.fetchInert ? undefined : this.connectedViews
        if (!connected) {
          return undefined
        }
        const view = this.view
        const { v0, v1 } = connected
        const { hoveredInstanceIdx, clickedInstanceIdx, instanceData } = self
        // Instance index -> 1-based featureId (0 = "no hit"), the id the
        // shaders/canvas compare against to highlight every instance of a
        // feature. Matches the `instanceFeatureIdx[i] + 1` mapping in
        // interleaveInstances and the pick engine. An index past the end reads
        // `undefined` and answers "no hit", the same way `getFeature` refuses
        // an out-of-range instance: asserting it non-null instead wrote
        // `NaN` into the clickedFeatureId uniform.
        const toFeatureId = (idx: number) => {
          const featureIdx =
            idx >= 0 ? instanceData?.instanceFeatureIdx[idx] : undefined
          return featureIdx === undefined ? 0 : featureIdx + 1
        }
        return {
          yTop: 0,
          height: this.height,
          alpha: view.alpha,
          fadeThinAlignments: view.fadeThinAlignments,
          minAlignmentLength: view.minAlignmentLength,
          hoveredFeatureId: toFeatureId(hoveredInstanceIdx),
          clickedFeatureId: toFeatureId(clickedInstanceIdx),
          offsetPx0: v0.offsetPx,
          offsetPx1: v1.offsetPx,
          bpPerPx0: v0.bpPerPx,
          bpPerPx1: v1.bpPerPx,
          drawCurves: view.drawCurves,
        }
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach.ts')
            doAfterAttach(self as typeof self & { afterAttach(): void })
          } catch (e) {
            console.error(e)
            self.setError(e)
          }
        })()
      },
    }))
}

export type LinearSyntenyDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export interface LinearSyntenyDisplayModel extends Instance<LinearSyntenyDisplayStateModel> {}

export default stateModelFactory

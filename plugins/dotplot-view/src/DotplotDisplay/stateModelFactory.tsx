import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { runLazyAfterAttach } from '@jbrowse/core/util/lazyAfterAttach'
import { types } from '@jbrowse/mobx-state-tree'
import { sharedBackendKey } from '@jbrowse/render-core/keyedRenderingBackend'
import {
  SyntenyFetchStateMixin,
  comparativeDisplayPhase,
  comparativeFetchFlags,
  getCoarseBpPerPxThreshold,
  resolveLodTier,
  swappedAssembliesWarning,
  syntenyFetchRegions,
} from '@jbrowse/synteny-core'

import { segmentCigarOp } from './dotplotCigarDetail.ts'
import { computeDotplotColors } from './dotplotColors.ts'
import { featureSegmentRange } from './dotplotPickEngine.ts'
import { cumBpToPxH, cumBpToPxV } from './dotplotProject.ts'
import { getDotplotTooltipLines } from './dotplotTooltip.ts'
import { dotplotFetchKey } from './fetchKey.ts'
import { renderSvg } from './renderSvg.tsx'

import type {
  DotplotViewModel,
  ExportSvgOptions,
} from '../DotplotView/model.ts'
import type { DotplotDisplayConfigSchema } from './configSchema.ts'
import type { DotplotInstanceData } from './dotplotRenderingBackendTypes.ts'
import type { DotplotHoverHighlight, DotplotRpcData } from './types.ts'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'
import type {
  ComparativeWarning,
  LodTier,
  SyntenyColorBy,
} from '@jbrowse/synteny-core'
import type { ThemeOptions } from '@mui/material'

// Path coordinates to a tenth of a pixel. Full float precision makes the `d`
// string several times longer for differences nothing can display.
function px(n: number) {
  return Math.round(n * 10) / 10
}

/**
 * #stateModel DotplotDisplay
 * #category display
 */
export function stateModelFactory(configSchema: DotplotDisplayConfigSchema) {
  return types
    .compose(
      'DotplotDisplay',
      BaseDisplay,
      SyntenyFetchStateMixin(),
      types
        .model({
          /**
           * #property
           */
          type: types.literal('DotplotDisplay'),
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
        })
        .volatile(() => ({
          /**
           * #volatile
           * RPC-computed feature data
           */
          rpcData: undefined as DotplotRpcData | undefined,
          /**
           * #volatile
           * GPU-instance positions produced from rpcData, self-describing via
           * embedded bpPerPx, with no colors in them. Rebuilt only when the
           * data or the zoom changes; the palette is joined on top by the
           * `geometry` getter.
           */
          instanceData: undefined as DotplotInstanceData | undefined,
          /**
           * #volatile
           * What the last completed fetch had to say about itself, written with
           * the data it describes (see `setRpcData`).
           */
          fetchWarnings: [] as ComparativeWarning[],
          /**
           * #volatile
           * Index into `instanceData`'s per-SEGMENT arrays of the line the
           * pointer is nearest, or -1.
           *
           * The segment rather than the feature, even though the tooltip and the
           * highlight are both about the feature: the feature index derives from
           * this one (`hoveredFeatureIdx` below), and the CIGAR operator under
           * the cursor derives from nothing else — a CIGAR-detailed alignment is
           * a staircase of segments and the pointer is on one step of it. Same
           * choice `LinearSyntenyDisplay.hoveredInstanceIdx` makes, where
           * `getFeature` does the translating.
           *
           * It addresses `instanceData`, so it is dropped by BOTH writers of
           * that — a zoom rebuilds the geometry without refetching.
           */
          hoveredSegmentIdx: -1,
        })),
    )
    .views(self => ({
      /**
       * #getter
       * The plot this display draws into. One getter rather than a
       * `getContainingView` cast per reader, the same way
       * `LinearSyntenyDisplay.view` answers it.
       *
       * This names the view type even though the view names this display back
       * (`dotplotDisplays`). That mutual reference resolves only because both
       * model types are declared as `interface … extends Instance<…>` rather
       * than `type … = Instance<…>` — see ADR-055.
       */
      get view() {
        return getContainingView(self) as DotplotViewModel
      },
      /**
       * #getter
       * Stable slot on the view-shared backend. Hashed from the node id, not
       * taken from the track's index, so hiding or reordering a sibling can't
       * hand this display another's buffer.
       */
      get displayKey() {
        return sharedBackendKey(self.id)
      },
      /**
       * #getter
       * A fetch has completed (data is present, even if it mapped zero
       * features). Not a feature-count test — an empty-but-finished fetch is
       * ready, otherwise an empty plot spins the loading overlay forever.
       */
      get ready() {
        return self.rpcData !== undefined
      },
      /**
       * #getter
       * Main-thread-computed per-segment colors — the gpuProps half of the
       * rpcProps/gpuProps split. A colorBy change recomputes this alone,
       * without re-walking a single CIGAR.
       *
       * Opacity is NOT read here. It rides the shader's `alpha` uniform (and
       * `drawDotplotInstances`' param) off `DotplotView.dotplotRenderState`, so
       * the slider is a redraw, not a recolor — the same split synteny makes.
       * Baking it in made every drag frame recompute this array, re-pack every
       * instance and re-upload the buffer.
       */
      get computedColors(): Uint32Array | undefined {
        const { instanceData, rpcData } = self
        return instanceData && rpcData
          ? computeDotplotColors({
              instanceData,
              rpcData,
              colorBy: this.colorBy,
              trackColor: this.trackColor,
              nameOrder: this.paintedChromosomeOrder,
              attributeRanges: this.view.attributeRanges,
            })
          : undefined
      },
      /**
       * #getter
       * The chromosome order the chromosome-painting modes color by: the
       * refNames of whichever axis' assembly `colorBy` names, in the assembly's
       * own order. Undefined for every other mode, and while the assembly is
       * still loading — the color function falls back to its hash there.
       *
       * It has to come from the assembly rather than from the features, because
       * a color must not change with which chromosomes happen to be in view.
       *
       * The dotplot twin of `LinearSyntenyDisplay.paintedChromosomeOrder`, off
       * the two axes instead of two stacked levels: 'query' is the horizontal
       * axis (the feature's own refName lane) and 'target' the vertical (the
       * mate's). 'reference' is a stacked-view mode with no dotplot meaning, and
       * the shared color function falls it back to query — with no order, since
       * naming an axis for it would be inventing an answer.
       */
      get paintedChromosomeOrder(): readonly string[] | undefined {
        const colorBy = this.colorBy
        if (colorBy !== 'query' && colorBy !== 'target') {
          return undefined
        }
        const assemblyName =
          this.view.assemblyNames[colorBy === 'query' ? 0 : 1]
        return assemblyName === undefined
          ? undefined
          : getSession(self).assemblyManager.get(assemblyName)?.refNames
      },
      /**
       * #getter
       * The mode this track renders with: its own override if the user set one,
       * else the plot-wide mode.
       */
      get colorBy(): SyntenyColorBy {
        return this.view.resolveColorBy(this.trackId)
      },
      /**
       * #getter
       * This track's slot in the plot's palette, used by `colorBy: 'track'`.
       * Assigned by the view, not locally: pinning a color on one track shifts
       * which automatic slots its siblings can take.
       */
      get trackColor(): string {
        return this.view.trackColorFor(this.trackId)
      },
      /**
       * #getter
       */
      get trackId(): string {
        return self.parentTrack.configuration.trackId
      },
      /**
       * #getter
       * Instance positions joined with the computed colors: what the backends
       * upload and what SVG export draws. The view's upload autorun reads this,
       * so a palette change re-uploads without rebuilding geometry.
       */
      get geometry() {
        const { instanceData } = self
        const colors = this.computedColors
        return instanceData && colors ? { ...instanceData, colors } : undefined
      },
      /**
       * #getter
       * Index into `rpcData`'s per-FEATURE arrays of the alignment the pointer is
       * over, or -1. Derived rather than stored, so it cannot disagree with
       * `hoveredSegmentIdx` about which alignment that is.
       *
       * Not `instanceFeatureIdx[i] ?? i`: an out-of-range segment index reads
       * `undefined` there, and falling back to the raw index would answer with a
       * different feature rather than with nothing. Same reasoning as
       * `LinearSyntenyDisplay.getFeature`.
       */
      get hoveredFeatureIdx(): number {
        const { hoveredSegmentIdx, instanceData } = self
        return hoveredSegmentIdx < 0
          ? -1
          : (instanceData?.instanceFeatureIdx[hoveredSegmentIdx] ?? -1)
      },
      /**
       * #getter
       * The hovered feature's tooltip, as lines, or undefined when nothing is
       * hovered. The dotplot twin of `LinearSyntenyDisplay.tooltipLines`; both
       * feed `ComparativeTooltip`, which renders lines as text nodes — see
       * `getDotplotTooltipLines`.
       */
      get tooltipLines(): string[] | undefined {
        const { hoveredSegmentIdx, instanceData, rpcData } = self
        const featureIdx = this.hoveredFeatureIdx
        return featureIdx < 0 || !rpcData
          ? undefined
          : getDotplotTooltipLines({
              rpcData,
              featureIdx,
              hview: this.view.hview,
              vview: this.view.vview,
              // The operator under the CURSOR, so it comes off the hovered
              // segment rather than the feature — one alignment's staircase can
              // hold a dozen of them.
              cigarOp: instanceData
                ? segmentCigarOp(instanceData, hoveredSegmentIdx)
                : undefined,
            })
      },
      /**
       * #getter
       * The hovered feature redrawn over the canvas: an SVG path of its segments
       * in plot px, plus its own packed color as CSS.
       *
       * This is the whole of the hover shading, and it deliberately isn't in
       * either renderer. Synteny boosts alpha and darkens rgb per fragment from
       * a `hoveredFeatureId` uniform, which costs an instance lane, a uniform, a
       * hand-written Canvas2D twin of the same arithmetic, and a broken color
       * run in `drawDotplotInstances`' batcher. Restroking one feature — a
       * handful of segments — over the shared canvas needs none of that, and is
       * backend-agnostic by construction: it draws the same over the GPU canvas
       * and the Canvas2D fallback because it never asks which one painted.
       * `renderSvg` deliberately does not draw it — an off-screen export has no
       * pointer, and a transient hover has no business in a figure.
       *
       * The cue is opacity + width, not hue: the plot's own `alpha` slider
       * routinely sits at 0.2, so restroking opaque and a few px wider is
       * exactly synteny's "the hovered one goes solid". Nothing here picks a
       * highlight color, because every hue is already in use — category10 paints
       * the chromosome modes, and red/blue/black are the strand and default
       * schemes.
       *
       * Recomputes on pan (through `plotTransform`'s `viewBpH`/`viewBpV`), which
       * is what keeps the highlight on its feature, and only while something is
       * hovered. `plotTransform` rather than `dotplotRenderState`, which carries
       * `alpha` and `lineWidth` too — an opacity drag would rebuild this path
       * once a frame for a value it does not read.
       */
      get hoveredFeatureHighlight(): DotplotHoverHighlight | undefined {
        const { instanceData } = self
        const hoveredFeatureIdx = this.hoveredFeatureIdx
        const colors = this.computedColors
        if (hoveredFeatureIdx < 0 || !instanceData || !colors) {
          return undefined
        }
        const { x1, y1, x2, y2, instanceFeatureIdx, instanceCount } =
          instanceData
        const [start, end] = featureSegmentRange(
          instanceFeatureIdx,
          instanceCount,
          hoveredFeatureIdx,
        )
        if (start >= end) {
          // The hovered feature has no segments any more — `minAlignmentLength`
          // was raised past it while the pointer sat still.
          return undefined
        }
        const { viewBpH, viewBpV, bpPerPxHInv, bpPerPxVInv, viewHeight } =
          this.view.plotTransform
        let path = ''
        for (let s = start; s < end; s++) {
          // The shared reconstruction, so the restroke lands on the pixels the
          // canvas painted.
          const sx1 = cumBpToPxH(x1[s]!, viewBpH, bpPerPxHInv)
          const sy1 = cumBpToPxV(y1[s]!, viewBpV, bpPerPxVInv, viewHeight)
          const sx2 = cumBpToPxH(x2[s]!, viewBpH, bpPerPxHInv)
          const sy2 = cumBpToPxV(y2[s]!, viewBpV, bpPerPxVInv, viewHeight)
          path += `M${px(sx1)} ${px(sy1)}L${px(sx2)} ${px(sy2)}`
        }
        return { path, color: abgrToCssRgba(colors[start]!) }
      },
      get fetchFlags() {
        return comparativeFetchFlags({
          ready: this.ready,
          hasDrawable: !!self.instanceData,
          fetching: self.fetching,
          error: self.error,
          fetchInert: self.fetchInert,
          fetchCanceled: self.fetchCanceled,
          loadedFetchKey: self.loadedFetchKey,
          currentFetchKey: this.currentFetchKey,
        })
      },
      /**
       * #getter
       * First load: no data has arrived yet. Drives the centered overlay.
       */
      get loading() {
        return this.fetchFlags.loading
      },
      /**
       * #getter
       * Refetch in-flight: a new fetch is running but a stale plot is still on
       * screen (zoom, diagonalize reorder, pan past the buffer). Drives a
       * subtle corner indicator instead of the full overlay so the visible
       * plot isn't masked on every viewport change.
       */
      get refetching() {
        return this.fetchFlags.refetching
      },
      /**
       * #getter
       * The h-axis fetch window: the visible content blocks expanded by the
       * shared pan buffer and snapped outward to a buffer-sized grid, so a pan
       * within the buffer neither refetches nor exposes an unfetched strip, and
       * zoomed out it collapses to the whole displayed region. The v axis is
       * deliberately not scoped: the fetch is one-dimensional (h regions in,
       * every mate out), so a vertical pan needs no data the h window didn't
       * already bring, and must never trigger a refetch.
       *
       * Unlike synteny, nothing culls this window again in the worker —
       * executeDotplotFeaturesAndPositions maps every feature it is handed — so
       * the window's only job is to be a superset of what's on screen.
       */
      get fetchRegions(): Region[] {
        return syntenyFetchRegions(this.view.hview)
      },
      /**
       * #getter
       * The fetch-input signature (see fetchKey.ts) for the view's current
       * state. Reactive: recomputes when either axis's zoom or displayed-region
       * order/orientation changes, or when a pan carries the h axis into a new
       * snapped fetch window. As a computed it only notifies when the string
       * itself changes, which is what lets the fetch autorun track it and stay
       * quiet through sub-buffer pans.
       */
      get currentFetchKey(): string {
        const { view } = this
        return dotplotFetchKey(
          this.lodTier,
          {
            bpPerPx: view.hview.bpPerPx,
            regionSignature: view.hRegionSignature,
          },
          {
            bpPerPx: view.vview.bpPerPx,
            regionSignature: view.vRegionSignature,
          },
          this.fetchRegions,
        )
      },
      /**
       * #getter
       * The detail tier this plot's fetch asks the adapter for. Resolved here on
       * the main thread, not adapter-side from `bpPerPx`, so it is part of
       * `currentFetchKey` — see `resolveLodTier`. Both axes feed it: CIGAR detail
       * is worth drawing when a block is wide on either one, so dropping to the
       * no-CIGAR tier is only safe once both are past the threshold.
       */
      get lodTier(): LodTier {
        const { view } = this
        return resolveLodTier({
          bpPerPx: Math.min(view.hview.bpPerPx, view.vview.bpPerPx),
          coarseBpPerPxThreshold: getCoarseBpPerPxThreshold(self.parentTrack),
          lodMode: view.lodMode,
        })
      },
      /**
       * #getter
       * True when the rendered rpcData was fetched for the view's current
       * inputs. Goes false the instant a zoom or diagonalize reorder changes the
       * axes — before the debounced refetch begins and while stale geometry is
       * still on screen — so the `settled` done-gate can't fire on it. The
       * dotplot analog of LGV's `viewportWithinLoadedData`.
       */
      get dataCurrent(): boolean {
        return this.fetchFlags.dataCurrent
      },
      /**
       * #getter
       * The display's own mutually-exclusive state, the way every LGV display
       * publishes one — so `AppReadyMarker` counts this display's fetch, and the
       * app stops reporting itself ready over a plot that is still
       * working. Ranked by `comparativeDisplayPhase`, off the shared canvas's
       * `surfaceReadiness` and this display's own fetch state.
       *
       * `DisplayStatusPhase`, not `DisplayPhase`: the view owns the
       * rendering backend, so this display can never be the one to report a
       * backend failure.
       */
      get displayPhase(): DisplayStatusPhase {
        return comparativeDisplayPhase(
          {
            error: self.error,
            fetchInert: self.fetchInert,
            loading: this.loading,
            refetching: this.refetching,
            dataCurrent: this.dataCurrent,
          },
          this.view.surfaceReadiness,
        )
      },
      /**
       * #getter
       * Per-render fetch warnings, plus the load-time reversed-assembly hint.
       */
      get warnings() {
        return self.assembliesSwapped
          ? [
              ...self.fetchWarnings,
              swappedAssembliesWarning(
                'The chromosome names in the file match the opposite axis. Try switching the X and Y assemblies in the dotplot import form.',
              ),
            ]
          : self.fetchWarnings
      },
      /**
       * #getter
       * Off-screen SVG export gate: "Export SVG" waits on this before drawing
       * (see the [SVG export guide](/docs/developer_guides/svg_export)) via the
       * shared `awaitSvgReady`. A failed track fails the export rather than
       * drawing itself into the plot; every display paints that one rect, so
       * `SVGDotplotView` fans them out through `awaitSvgRenders` and names all
       * of them at once. The terms are in `comparativeFetchFlags`.
       */
      get svgReady() {
        return this.fetchFlags.svgReady
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      renderSvg(opts: ExportSvgOptions & { theme?: ThemeOptions }) {
        return renderSvg(self, opts)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Commits a fetch result and the warnings it raised, tagged with the key
       * it was fetched for. One action, not three: the warnings describe this
       * result, so writing them separately let a failed refetch leave the last
       * result's warnings standing over data they no longer describe, and each
       * extra action is another round of the view's warning/upload observers
       * per RPC completion. Same reason `LinearSyntenyDisplay.setRpcData` takes
       * its feature and instance data together.
       *
       * The loading flags are deliberately NOT touched here: this runs as
       * `installComparativeFetchAutorun`'s `commit`, whose `finally` clears
       * `fetching` and the status line under the same staleness guard. Clearing
       * them here too meant one of the two comparative displays wrote
       * `fetching` directly instead of through `setFetching`, for no effect the
       * skeleton wasn't about to have anyway.
       *
       * `setError` is not overridden either: the two callers that set one
       * (the fetch skeleton's `catch`, `afterAttach`'s) already log it, so the
       * override this display used to carry printed every fetch failure twice
       * — and had to special-case `undefined` because the skeleton clears the
       * error through the same setter before every fetch.
       */
      setRpcData(
        data: DotplotRpcData,
        fetchKey: string,
        warnings: ComparativeWarning[],
      ) {
        self.rpcData = data
        self.loadedFetchKey = fetchKey
        self.fetchWarnings = warnings
        // The hover index describes the geometry built from the OUTGOING
        // rpcData, so it is meaningless against what replaces it: a surviving
        // index points at an unrelated alignment. Same reason, same place, as
        // `LinearSyntenyDisplay.setRpcData` clearing its own. The next
        // pointermove re-picks anyway — a refetch is a zoom/pan/mode change,
        // after which the pointer is no longer over whatever it was hovering.
        self.hoveredSegmentIdx = -1
      },
      setInstanceData(data: DotplotInstanceData | undefined) {
        self.instanceData = data
        // ...and the other writer of the arrays the index addresses. This one is
        // the reason the hover is stored as a segment index rather than a
        // feature index: a zoom, a `drawCigar` toggle or a `minAlignmentLength`
        // change rebuilds the geometry WITHOUT a refetch, which renumbers every
        // segment while leaving the feature numbering alone.
        self.hoveredSegmentIdx = -1
      },
      /**
       * #action
       * Written by the view's `setHoveredFeature`, which points the whole plot's
       * hover at one hit — never per display from a component, so the N writes
       * land in one MobX batch.
       */
      setHoveredSegmentIdx(idx: number) {
        self.hoveredSegmentIdx = idx
      },
    }))
    .actions(self => ({
      afterAttach() {
        runLazyAfterAttach(
          self,
          async () => (await import('./afterAttach.ts')).doAfterAttach,
        )
      },
    }))
}

// An interface, not `type … = Instance<…>`: this display names its view
// (`self.view`) and the view names this list of displays back, and only the
// interface form defers that mutual reference instead of collapsing it. See
// ADR-055.
export interface DotplotDisplayModel extends Instance<
  ReturnType<typeof stateModelFactory>
> {}

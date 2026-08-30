import { getContainingView, getSession } from '@jbrowse/core/util'
import {
  hideTrackGeneric,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { installUpload } from '@jbrowse/render-core/installUpload'
import {
  comparativeSurfacePhase,
  comparativeSurfaceSettled,
  installClearHoverOnSurfaceMove,
} from '@jbrowse/synteny-core'
import { runInAction } from 'mobx'

import {
  captureStackViewports,
  mateFlightAllowed,
  mateNavDestination,
  takeFollowAnchor,
} from './offscreenMateNav.ts'

import type { OffscreenMateLocus } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type {
  SyntenyPickResult,
  SyntenyRenderState,
  SyntenyRenderingBackend,
  SyntenyTrackRenderParams,
} from '../LinearSyntenyDisplay/syntenyRenderingBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { ParentViewDuck } from './parentViewDuck.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { DisplayInitialSnapshot } from '@jbrowse/core/util/tracks'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'
import type { ComparativeSurface } from '@jbrowse/synteny-core'

/**
 * #stateModel LinearSyntenyViewHelper
 * Holds one level of a linear synteny comparison: its track list, height and
 * level index, composed with the shared rendering-lifecycle state.
 *
 * Nested in LinearComparativeView.levels, never in session.views: it is a track
 * container, not a view, and satisfies core's `TrackContainer` so the
 * track-selector and add-track widgets can write into it via the parent view's
 * `trackContainerFor`. The `LinearSyntenyViewHelper` name and `type` literal are
 * kept only because saved sessions persist them.
 */
export function linearSyntenyViewHelperModelFactory(
  pluginManager: PluginManager,
) {
  return types
    .compose(
      'LinearSyntenyViewHelper',
      RenderLifecycleMixin(),
      types.model({
        /**
         * #property
         */
        id: ElementId,
        /**
         * #property
         */
        type: 'LinearSyntenyViewHelper',
        /**
         * #property
         */
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        ),
        /**
         * #property
         */
        height: types.stripDefault(types.number, 100),
        /**
         * #property
         */
        level: types.number,
      }),
    )
    .views(self => ({
      /**
       * #getter
       * Typed accessor for the slot-mixin-owned `currentRenderingBackend`. All
       * synteny displays within the level upload their geometry to the same
       * backend and render onto one canvas.
       */
      get gpuRenderingBackend(): SyntenyRenderingBackend | undefined {
        return self.currentRenderingBackend as
          | SyntenyRenderingBackend
          | undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setHeight(n: number) {
        self.height = n
      },
      /**
       * #action
       */
      // annotated, not inferred: see LinearComparativeView.showTrack, which
      // delegates here
      showTrack(
        trackId: string,
        initialSnapshot: object = {},
        displayInitialSnapshot: DisplayInitialSnapshot = {},
        inlineConf?: Record<string, unknown>,
      ) {
        return showTrackGeneric(
          self,
          trackId,
          initialSnapshot,
          displayInitialSnapshot,
          inlineConf,
        )
      },
      /**
       * #action
       */
      hideTrack(trackId: string) {
        return hideTrackGeneric(self, trackId)
      },
      /**
       * #action
       */
      toggleTrack(trackId: string) {
        return toggleTrackGeneric(self, trackId)
      },
    }))
    .views(self => ({
      // The LinearSyntenyView this level belongs to. getContainingView rather
      // than a hop count: a level has no width/setWidth, so isViewModel walks
      // past it to the real view.
      get parentView() {
        return getContainingView(self) as unknown as ParentViewDuck
      },
      // The pair of genome rows this level draws between, or [] for a trailing
      // level that has no row below it yet.
      get assemblyNames(): string[] {
        const { views } = this.parentView
        const v0 = views[self.level]
        const v1 = views[self.level + 1]
        return v0 && v1
          ? [v0.assemblyNames[0] ?? '', v1.assemblyNames[0] ?? '']
          : []
      },
      /**
       * #getter
       * All synteny displays under this level's tracks.
       */
      get linearSyntenyDisplays() {
        const out: LinearSyntenyDisplayModel[] = []
        for (const track of self.tracks) {
          for (const display of track.displays) {
            if (display.type === 'LinearSyntenyDisplay') {
              out.push(display as LinearSyntenyDisplayModel)
            }
          }
        }
        return out
      },
      /**
       * #getter
       * Every number that moves a ribbon under a stationary cursor — each
       * connected row's `offsetPx` and `bpPerPx`, plus the band height — as one
       * key, which `installClearHoverOnSurfaceMove` watches. Empty until both
       * rows are there, which no viewport can produce.
       */
      get bandTransformKey() {
        const { views } = this.parentView
        const v0 = views[self.level]
        const v1 = views[self.level + 1]
        return v0 && v1
          ? `${v0.offsetPx}_${v0.bpPerPx}_${v1.offsetPx}_${v1.bpPerPx}_${self.height}`
          : ''
      },
      /**
       * #getter
       * Every failed track's error in this level, joined into the one value the
       * band has room to report. On-screen only — an SVG export has nowhere to
       * float a banner, so it fails outright from `awaitSvgReady`.
       */
      get displayError() {
        const errors = this.linearSyntenyDisplays
          .map(d => d.error)
          .filter(e => e != null)
        return errors.length > 0 ? errors.join('\n') : undefined
      },
      /**
       * #getter
       * This level's band as the displays drawing onto it see it: first paint,
       * plus the parent-view flags that mean what is on screen is not the answer
       * yet. `displayPhase` and `settled` are both computed from it.
       */
      get surfaceReadiness(): ComparativeSurface {
        const { initPending, pendingAutoDiagonalize, effectiveBodyMounted } =
          this.parentView
        return {
          painted: self.painted,
          initPending,
          pendingAutoDiagonalize,
          renderError: self.renderError,
          hostMounted: effectiveBodyMounted,
        }
      },
      /**
       * #getter
       * What the shared canvas publishes as `data-display-phase`: the ranking
       * over the ribbons drawing onto it. `settled` below is the stricter
       * question — see `comparativeReadiness`.
       */
      get displayPhase(): DisplayStatusPhase {
        return comparativeSurfacePhase(
          this.surfaceReadiness,
          this.linearSyntenyDisplays,
        )
      },
      /**
       * #getter
       * The canvas has painted and no display is still fetching, so what is on
       * screen is final. Drives `synteny_canvas`'s `data-display-drawn`, which
       * screenshot capture and the browser suites wait on — so it means "done",
       * not "first paint". `comparativeReadiness` says why an error answers this
       * and "is every display finished" differently.
       */
      get settled() {
        return comparativeSurfaceSettled(
          this.surfaceReadiness,
          this.linearSyntenyDisplays,
        )
      },
    }))
    .actions(self => {
      // Point one of the level's per-instance states at a pick hit: the hit
      // display takes the instance index, every other clears, so `undefined`
      // clears the level. One walk, so the N writes land in one MobX batch.
      function point(
        hit: SyntenyPickResult | undefined,
        write: (display: LinearSyntenyDisplayModel, idx: number) => void,
      ) {
        let hitDisplay: LinearSyntenyDisplayModel | undefined
        for (const display of self.linearSyntenyDisplays) {
          if (hit && display.displayKey === hit.key) {
            hitDisplay = display
            write(display, hit.instanceIndex)
          } else {
            write(display, -1)
          }
        }
        return hitDisplay
      }
      return {
        /**
         * #action
         */
        setHoveredFeature(hit: SyntenyPickResult | undefined) {
          return point(hit, (display, idx) => {
            display.setHoveredInstanceIdx(idx)
          })
        },
        /**
         * #action
         * Clicked-state twin of `setHoveredFeature`.
         */
        setClickedFeature(hit: SyntenyPickResult | undefined) {
          return point(hit, (display, idx) => {
            display.setClickedInstanceIdx(idx)
          })
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * Per-display GPU geometry keyed by displayKey. The upload autorun
       * diffs this map — new entries upload, vanished entries evict.
       */
      get geometryByDisplayKey() {
        const m = new Map<number, SyntenyInstanceData>()
        for (const display of self.linearSyntenyDisplays) {
          // Read renderInstanceData (main-thread-recolored) not instanceData,
          // so colorBy changes re-upload without an RPC refetch.
          const data = display.renderInstanceData
          if (data) {
            m.set(display.displayKey, data)
          }
        }
        return m
      },
      /**
       * #getter
       * Aggregated per-frame render state, always resolved — "the view isn't
       * measured yet" is `canRender`'s precondition. An empty `perTrack` is a
       * real frame rather than a skip: the backend clears before drawing, so
       * painting zero tracks is what drops a hidden track's ribbons.
       */
      get syntenyRenderState(): SyntenyRenderState {
        const perTrack = new Map<number, SyntenyTrackRenderParams>()
        for (const display of self.linearSyntenyDisplays) {
          const params = display.renderParams
          if (params) {
            perTrack.set(display.displayKey, params)
          }
        }
        return {
          overdrawPx: self.parentView.overdrawPx,
          perTrack,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The pointer is over a ribbon somewhere in this band. Drives the canvas
       * cursor, which is the only thing that says a ribbon can be clicked at
       * all — the hover shading is subtle at the default 0.2 opacity.
       */
      get hoveringFeature() {
        return self.linearSyntenyDisplays.some(d => d.hoveredInstanceIdx >= 0)
      },
      /**
       * #method
       * The display a pick hit belongs to.
       */
      displayFor(key: number) {
        return self.linearSyntenyDisplays.find(d => d.displayKey === key)
      },
      /**
       * #getter
       * Render-lifecycle precondition, overriding `RenderLifecycleMixin`'s
       * default-true hook: the render callback sizes the canvas off
       * `parentView.width`, which throws by design before the view is measured.
       */
      get canRender() {
        return self.parentView.initialized
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Show the contig an off-screen mate mark points at, on the row that is
       * not displaying it — what clicking a mark does.
       *
       * `row` rather than `level + 1`: a level has a strip on each edge, so a
       * mark on the query axis names a contig the row BELOW is not showing and
       * one on the target axis names a contig the row ABOVE is not. The caller
       * resolved which strip it hit. `mate` carries the mark's two coordinates
       * as one argument, so they cannot come apart from each other or from the
       * class they decide; omitted means the whole contig.
       *
       * A contig the row has is scrolled to and one it does not is added to its
       * regions — neither discards what the row was showing. The click takes the
       * follow anchor too, and the Undo gives back the anchor and every row's
       * viewport together. `agent-docs/ideas/offscreen-synteny-mates.md` is the
       * case for all of it.
       */
      showOffscreenMateContig(
        refName: string,
        row: number,
        mate?: { locus: OffscreenMateLocus; mateCumBp?: OffscreenMateLocus },
      ) {
        const { parentView } = self
        const view = parentView.views[row]
        if (!view) {
          return
        }
        const session = getSession(self)
        const dest = mateNavDestination({ node: self, view, refName, mate })
        if (dest.kind === 'none') {
          session.notify(dest.reason, 'warning')
          return
        }
        // Captured before the take, which already re-places the other rows.
        const restoreStack = captureStackViewports([...parentView.views])
        const anchor = takeFollowAnchor(parentView, row)
        if (dest.kind === 'scroll') {
          // Flown rather than jumped where the reader wants motion: this class
          // arises over stacked whole assemblies, so it is a jump of a
          // chromosome or more. The destination is the same either way, and the
          // flight reads back what it wrote each frame, so the Undo below ends
          // it rather than being overwritten by its next frame.
          if (mateFlightAllowed(parentView, session.animationMode)) {
            view.flyToCenter(dest.coord0, dest.refName)
          } else {
            view.centerAt(dest.coord0, dest.refName)
          }
        } else {
          // One transaction: called apart, the two publish a viewport in
          // between and a per-bp consumer scans a window never on screen.
          view.showRegions(dest.regions, dest.location)
        }
        session.notify(
          anchor.taken
            ? `Showing ${dest.loc}, and following this row`
            : `Showing ${dest.loc}`,
          'info',
          {
            name: 'Undo',
            onClick: () => {
              // one transaction, so the follow sees the settled pre-click state
              // rather than a half-restored one
              runInAction(() => {
                restoreStack()
                anchor.release()
              })
            },
          },
        )
      },
      /**
       * #action
       */
      startRenderingBackend(backend: SyntenyRenderingBackend) {
        // renderInstanceData is MST-cached, so the identity diff keeps an
        // upload-autorun re-fire from one display off the others' buffers.
        installUpload(self, backend, {
          cells: () => self.geometryByDisplayKey,
          render: b => {
            // the parent's own width, not views[0]'s: the same number with no
            // assertion on a row that may not exist yet
            b.resize(self.parentView.width, self.height)
            b.render(self.syntenyRenderState)
            return true
          },
        })
      },
      afterAttach() {
        // No `super`: our MST fork auto-chains lifecycle hooks.
        //
        // The clear is on the LEVEL because the level owns the hover —
        // `setHoveredFeature` fans one pick hit across every display in the
        // band. It watches `bandTransformKey` rather than pointer events: a
        // wheel scroll-zooms both rows while `useWheelScrollZoom` suppresses
        // the hover handler, and `setRpcData`'s clear runs only when a fetch
        // commits, which a pan inside the snapped window does not.
        installClearHoverOnSurfaceMove(self, {
          transform: () => self.bandTransformKey,
          clear: () => {
            self.setHoveredFeature(undefined)
          },
          name: 'SyntenyClearHoverOnBandMove',
        })
      },
    }))
}

export type LinearSyntenyViewHelperStateModel = ReturnType<
  typeof linearSyntenyViewHelperModelFactory
>
export type LinearSyntenyViewHelperModel =
  Instance<LinearSyntenyViewHelperStateModel>

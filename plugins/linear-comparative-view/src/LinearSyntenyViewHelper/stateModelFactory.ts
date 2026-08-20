import { getContainingView, getSession } from '@jbrowse/core/util'
import {
  hideTrackGeneric,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { installKeyedLifecycle } from '@jbrowse/render-core/installKeyedLifecycle'
import {
  comparativeSurfacePhase,
  comparativeSurfaceSettled,
} from '@jbrowse/synteny-core'

import { installClearHoverOnBandMove } from './installClearHoverOnBandMove.ts'

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
      showTrack(trackId: string, initialSnapshot: object = {}) {
        return showTrackGeneric(self, trackId, initialSnapshot)
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
       * The numbers that move a ribbon under a stationary cursor: each
       * connected row's `offsetPx` and `bpPerPx`, plus the band height the
       * ribbons are drawn through. Synteny's twin of `DotplotView.plotTransform`
       * — and, like it, the value `installClearHoverOnBandMove` watches to
       * decide the picture has moved.
       *
       * A key rather than the object dotplot returns, because nothing else
       * consumes it: a string only differs when a number does, so a
       * re-evaluation that lands on the same viewport fires nothing. Taking
       * these off `LinearSyntenyDisplay.renderParams` instead would subscribe
       * the reaction to `hoveredFeatureId` — which the reaction itself writes,
       * so it would re-fire on its own effect.
       *
       * Empty while the rows are not both there (a trailing level, or before
       * init), which no viewport can produce, so the first real value is a
       * change and any hover held across init clears with it.
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
       * Every failed track's error in this level, combined into the one value
       * the band has room to report — resolved here rather than per display
       * because they all paint the same full-height band. On-screen only: it is
       * one banner floating over the ribbons that did render, and a figure has
       * nowhere to float one, so a failed track fails the SVG export outright
       * from that display's own `awaitSvgReady`.
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
       * plus the two parent-view flags that mean what is on screen is not the
       * answer yet. Published here so a display reads one field instead of
       * walking to the level for paint and on to the view for the init flags —
       * and so `settled` below and every display's `displayPhase` are computed
       * from the same three values.
       */
      get surfaceReadiness(): ComparativeSurface {
        const { initPending, pendingAutoDiagonalize } = this.parentView
        return { painted: self.painted, initPending, pendingAutoDiagonalize }
      },
      /**
       * #getter
       * What the shared canvas publishes as `data-display-phase`: the ranking
       * over the ribbons drawing onto it. Its twin `settled` below is the
       * stricter question — see `comparativeReadiness`.
       */
      get displayPhase(): DisplayStatusPhase {
        return comparativeSurfacePhase(
          this.surfaceReadiness,
          this.linearSyntenyDisplays,
        )
      },
      /**
       * #getter
       * Canvas has painted and no display is still fetching, so what's on
       * screen is the final settled content. Drives `synteny_canvas`'s `data-display-drawn`
       * test-id, which screenshot capture and the browser-test suites wait on
       * before snapshotting — so it must mean "done", not just "first paint".
       *
       * Not the same question as "is every display finished" — see
       * `comparativeReadiness`, which holds both and says why an error answers
       * them differently.
       */
      get settled() {
        return comparativeSurfaceSettled(
          this.surfaceReadiness,
          this.linearSyntenyDisplays,
        )
      },
    }))
    .actions(self => {
      // Point one of the level's per-instance states at a pick hit: the display
      // whose geometry was hit takes the instance index, every other display
      // clears, and `undefined` (a miss) therefore clears the level. One walk
      // rather than a loop in the canvas component, so the N writes land in one
      // MobX batch — and it hands back the display it resolved to, which is the
      // only thing the caller wanted the key for.
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
       * Aggregated per-frame render state — a resolved value, never undefined;
       * "the view isn't measured yet" is the `canRender` precondition below.
       * Every display in the level draws starting at yTop=0 since each level
       * owns its own canvas.
       *
       * An empty `perTrack` is a real frame, not a skip: the row pair has no
       * synteny track (a legal launch — the rows just stack with no ribbons),
       * the one it had was hidden, or every one is minimized. The backend
       * clears before drawing, so painting zero tracks is what drops a hidden
       * track's ribbons.
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
       * The display a pick hit belongs to. A scan over the level's handful of
       * displays, not a keyed map: the map this replaces was a computed no
       * reaction observed, so every access rebuilt it in full anyway.
       */
      displayFor(key: number) {
        return self.linearSyntenyDisplays.find(d => d.displayKey === key)
      },
      /**
       * #getter
       * Render-lifecycle precondition (overrides `RenderLifecycleMixin`'s
       * default-true hook): the render callback sizes the canvas off
       * `parentView.width`, which throws by design before the view is
       * measured. Gating the autorun pair here is what lets
       * `syntenyRenderState` stay a resolved getter.
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
       * `navToLocString` REPLACES that row's displayed regions, which is exactly
       * the narrowing the synteny follow must never do to itself. Here it is the
       * whole request: the mark says "these go to ctgB", and the only thing that
       * turns it into a ribbon is the row below showing ctgB. That row keeps its
       * own header, so undoing it is "Show all regions".
       */
      showOffscreenMateContig(refName: string) {
        self.parentView.views[self.level + 1]
          ?.navToLocString(refName)
          .catch((e: unknown) => {
            getSession(self).notifyError(`${e}`, e)
          })
      },
      /**
       * #action
       */
      startRenderingBackend(backend: SyntenyRenderingBackend) {
        // renderInstanceData is MST-cached; its reference is stable while
        // upstream deps are unchanged, so the identity diff keeps an
        // upload-autorun re-fire from one display off the other displays'
        // buffers.
        installKeyedLifecycle<SyntenyInstanceData, SyntenyRenderingBackend>(
          self,
          backend,
          {
            entries: () => self.geometryByDisplayKey,
            render: b => {
              // the parent's own width, not views[0]'s: the same number one hop
              // closer (the view pushes it down to every row) and no assertion
              // on a row that may not exist yet
              b.resize(self.parentView.width, self.height)
              b.render(self.syntenyRenderState)
              return true
            },
          },
        )
      },
      afterAttach() {
        // No `super`: our MST fork auto-chains lifecycle hooks, so calling it
        // would re-enter RenderLifecycleMixin's own.
        installClearHoverOnBandMove(self)
      },
    }))
}

export type LinearSyntenyViewHelperStateModel = ReturnType<
  typeof linearSyntenyViewHelperModelFactory
>
export type LinearSyntenyViewHelperModel =
  Instance<LinearSyntenyViewHelperStateModel>

import { getContainingView, getSession } from '@jbrowse/core/util'
import {
  hideTrackGeneric,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
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
  navLocString,
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
       * `row` rather than `level + 1`, because a level has a strip on each edge:
       * a mark on the query axis names a contig the row BELOW is not showing,
       * and one on the target axis names a contig the row ABOVE is not. The
       * caller resolved which strip it hit, and the hit carries the answer.
       *
       * THE LOCUS, NOT THE CONTIG. A bare refName is a whole chromosome, so
       * every click used to answer a question about one locus by zooming out
       * past every other one — and the mate coordinates that make it answerable
       * were being collected and dropped (`collectOffscreenMates`). `grow` and a
       * floor rather than an exact span, so the ribbons that now have both ends
       * have something around them to be read against at either end of the size
       * range. Every mark carries one; the bare form here is for a caller that
       * has a contig and nothing else.
       *
       * A CONTIG THAT ROW ALREADY HAS IS SCROLLED TO, not navigated to. Its
       * marks are the ones the band is culling rather than the ones it never
       * had a second endpoint for (`culledRibbonMates`), and that class arises
       * precisely where the row displays everything — so replacing its regions
       * would answer "your mate is over there" by discarding every other
       * chromosome of the row the mark was pointing at. The rest below is the
       * other class.
       *
       * `navToLocString` REPLACES that row's displayed regions, which is exactly
       * the narrowing the synteny follow must never do to itself. Here it is the
       * whole request: the mark says "these go to ctgB", and the only thing that
       * turns it into a ribbon is that row showing ctgB. That replacement is
       * also why this offers an UNDO rather than leaving the reader to
       * reconstruct what the row was showing: what it replaced is a region list
       * they may have spent several navigations building, and "Show all regions"
       * — the only thing that was on offer — is not it.
       *
       * IT ALSO TAKES THE ANCHOR, when the follow is on and this is not already
       * the anchor row. A row the follow MOVES is re-asserted onto the anchor's
       * mapping every time the anchor settles — that is what the exact pass is
       * for, "re-asserting the follow over a row the user dragged" — so the
       * click ran, posted its snackbar, and the row came straight back
       * (`LinearSyntenyOffscreenMateFollow.test.tsx` is the proof). Anchoring
       * the row is what the click MEANS: this row should show that contig, and
       * the others should come to it. The undo puts the anchor back too.
       */
      showOffscreenMateContig(
        refName: string,
        row: number,
        // ONE ARGUMENT, because `displayed` without a locus is the state that
        // sends the scroll class down the region-replacing branch — see
        // `OffscreenMateSpan`. Nested, the pair cannot come apart: no mate is
        // the whole contig, which is what a click did before there were
        // coordinates. `OffscreenMateNavHit` is one of these.
        mate?: { locus: OffscreenMateLocus; displayed?: boolean },
      ) {
        const { parentView } = self
        const view = parentView.views[row]
        if (view) {
          // before the take, which already re-places the other rows
          const restoreStack = captureStackViewports([...parentView.views])
          const anchor = takeFollowAnchor(parentView, row)
          // A CONTIG THE ROW ALREADY HAS scrolls, and must not go through
          // `navToLocString`: that REPLACES the row's displayed regions, so a
          // click on a mark in a stack of whole assemblies — the arrangement
          // that produces these marks in the first place — would answer "your
          // mate is over there" by throwing away every other chromosome of the
          // row it was pointing at.
          if (mate?.displayed) {
            const center = Math.round((mate.locus.start + mate.locus.end) / 2)
            // FLOWN, not jumped, when the reader wants motion. The scroll class
            // arises where a row displays whole assemblies, so this is a jump of
            // a chromosome or more: landed instantly, the reader is somewhere
            // else with no way to tell what they passed over, and the marks that
            // became ribbons are just a different picture. The arc pulls back
            // far enough to hold both ends, travels, and drops in — and with the
            // follow on, the whole stack comes with it, since the follow's frame
            // pass is already the thing that tracks a row through a drag.
            //
            // The destination is the same either way, which is what leaves the
            // snackbar, the Undo and the anchor take below untouched: the Undo
            // writes the pre-click window, and the flight reads back what it
            // wrote each frame, so pressing it mid-flight ends the flight rather
            // than being overwritten by its next frame.
            if (mateFlightAllowed(parentView, getSession(self).animationMode)) {
              view.flyToCenter(center, refName)
            } else {
              view.centerAt(center, refName)
            }
            getSession(self).notify(
              anchor.taken
                ? `Showing ${refName}:${center.toLocaleString()}, and following this row`
                : `Showing ${refName}:${center.toLocaleString()}`,
              'info',
              {
                name: 'Undo',
                onClick: () => {
                  runInAction(() => {
                    restoreStack()
                    anchor.release()
                  })
                },
              },
            )
            return
          }
          const loc = navLocString(refName, mate?.locus)
          view
            .navToLocString(loc)
            .then(landed => {
              // The level can be detached while the navigation is in flight —
              // the track holding it removed, the view closed — and
              // `getSession` throws on a dead node, inside a `then` whose
              // `catch` would then call it a second time.
              //
              // `landed` is the other half: `navToLocString` resolves without
              // navigating when the contig is not a refName here and the text
              // search raises a picker over the hits instead — ordinary for a
              // PAF naming contigs `1`,`2` against an assembly spelling them
              // `chr1`,`chr2`. Reported as a move, that posted "Showing 2, and
              // following this row" with a live Undo over a stack nothing had
              // touched, and kept the anchor.
              if (isAlive(self) && isAlive(view) && landed) {
                getSession(self).notify(
                  anchor.taken
                    ? `Showing ${loc}, and following this row`
                    : `Showing ${loc}`,
                  'info',
                  {
                    name: 'Undo',
                    onClick: () => {
                      // one transaction, so the follow sees the settled
                      // pre-click state rather than a half-restored one
                      runInAction(() => {
                        restoreStack()
                        anchor.release()
                      })
                    },
                  },
                )
              } else {
                anchor.release()
              }
            })
            .catch((e: unknown) => {
              // an unresolvable contig is ordinary — mate names come out of the
              // alignment file, and the facing assembly need not have them
              anchor.release()
              if (isAlive(self)) {
                getSession(self).notifyError(`${e}`, e)
              }
            })
        }
      },
      /**
       * #action
       */
      startRenderingBackend(backend: SyntenyRenderingBackend) {
        // renderInstanceData is MST-cached; its reference is stable while
        // upstream deps are unchanged, so the identity diff keeps an
        // upload-autorun re-fire from one display off the other displays'
        // buffers.
        installUpload(self, backend, {
          cells: () => self.geometryByDisplayKey,
          render: b => {
            // the parent's own width, not views[0]'s: the same number one hop
            // closer (the view pushes it down to every row) and no assertion
            // on a row that may not exist yet
            b.resize(self.parentView.width, self.height)
            b.render(self.syntenyRenderState)
            return true
          },
        })
      },
      afterAttach() {
        // No `super`: our MST fork auto-chains lifecycle hooks, so calling it
        // would re-enter RenderLifecycleMixin's own.
        //
        // The shared clear for a stored hover over a shared canvas. On the
        // level rather than the display because the level owns the hover —
        // `setHoveredFeature` fans one pick hit across every display in the
        // band. `bandTransformKey` is the one value carrying every number that
        // moves the band under a stationary cursor (see its getter): a wheel
        // over the canvas scroll-zooms both rows while `useWheelScrollZoom`
        // suppresses the hover handler, so the commonest way to move the
        // picture fires no pointer event, and `setRpcData`'s clear only runs
        // when a fetch commits — a pan inside the snapped fetch window or a
        // zoom inside the log2 bucket commits nothing.
        installClearHoverOnSurfaceMove(self, {
          transform: () => self.bandTransformKey,
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

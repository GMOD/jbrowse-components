import { getNotificationSink } from '@jbrowse/core/util'
import { addDisposer, addMiddleware, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import { navToResolvedSpan } from '../LinearSyntenyDisplay/moveMatchingPanel.ts'
import { alreadyShowing } from './alreadyShowing.ts'
import {
  followAnchorWindow,
  followAnchorWindows,
  followPlacedWindows,
  sameWindows,
} from './followAnchorWindow.ts'
import { logFollowSpread, logFollowStep } from './followDebug.ts'
import { followFrameSpan } from './followFrameSpan.ts'
import { EMPTY_FOLLOW_REPORT } from './followHost.ts'
import { createFollowLevelStates } from './followLevelStates.ts'
import { followRung } from './followRung.ts'
import { followSpreadSpans } from './followSpreadSpans.ts'
import { followTransform } from './followTransform.ts'
import { planFollowStep } from './planFollowStep.ts'
import {
  positionViewOnSpan,
  positionViewOnSpans,
  spanBounds,
} from './positionViewOnSpan.ts'
import { requestCigarMap } from './requestCigarMap.ts'
import { decideSpread } from './spreadDecision.ts'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { AnchorWindow, FollowWindow } from './followAnchorWindow.ts'
import type { FollowAnchorHost, FollowReport } from './followHost.ts'
import type { FollowLevelState } from './followLevelStates.ts'
import type { FollowStep } from './planFollowStep.ts'
import type {
  LinearGenomeViewModel,
  RegionsOrientation,
} from '@jbrowse/plugin-linear-genome-view'

export interface FollowLevel {
  linearSyntenyDisplays: LinearSyntenyDisplayModel[]
}

export interface FollowPair {
  level: FollowLevel
  stayingView: LinearGenomeViewModel
  movingView: LinearGenomeViewModel
  toMate: boolean
  mateAssembly?: string
}

export interface SyntenyFollowHost extends FollowAnchorHost {
  followMatchOrientation: boolean
  sameScale: boolean
  followPairs: FollowPair[]
  setFollowReport: (report: Partial<FollowReport>) => void
  views: readonly { displayedRegions: readonly unknown[]; bpPerPx: number }[]
}

// The root actions a person's own gesture on a row produces.
// `gestureTakesAnchor.integration.test.ts` holds this set and the next against
// the view's action list.
export const ROW_GESTURES = new Set([
  'horizontalScroll',
  'zoomTo',
  'zoom',
  'scrollTo',
  'slide',
  'moveTo',
  'navTo',
  'flyTo',
  'flyToCenter',
  'flyToFit',
  'navToLocString',
  'navigateNewestHighlight',
  'showAllRegions',
  'showAllRegionsInAssembly',
  'fitAllRegions',
])

// The row's other navigations: the tails a gesture reaches for after an await,
// as fresh roots, the primitives the follow writes through, the stack's zoom
// ceiling, and `horizontallyFlip`, since a hand flip of a followed row stands.
export const ROW_NAVIGATIONS_HELD = new Set([
  'navToLocations',
  'navToLocation',
  'navToMultiple',
  'showRegions',
  'setWindow',
  'setWindowFrame',
  'scrollToBp',
  'setNewView',
  'setDisplayedRegions',
  'clampZoomToCeiling',
  'horizontallyFlip',
])

// One level's placement, with the observables the async half needs already read
// off the tree. `step` carries the window, the display and `toMate`; the
// staying row comes back only to ask whether it still shows `windows`.
interface FollowWork {
  kind: 'resolve'
  level: FollowLevel
  movingView: LinearGenomeViewModel
  step: FollowStep
  // absent for a carried level, whose windows are this pass's own placement
  staying?: { view: LinearGenomeViewModel; windows: FollowWindow[] }
  movingMinWidthBp: number
  // read in the plan, so the checkbox wakes the pass
  matchOrientation: boolean
  anchorOrientation: RegionsOrientation
  seq: number
  generation: number
}

// What this pass placed each row it moves on, which the level beyond reads
// instead of the row's blocks, since those include the filler between two
// mapped contigs. Keyed by the row, a level's moving row being the next
// level's staying row.
type PlacedWindows = Map<LinearGenomeViewModel, FollowWindow[]>

interface SpreadWork {
  kind: 'spread'
  level: FollowLevel
  movingView: LinearGenomeViewModel
  spans: ResolvedSpan[]
}

interface FollowPlan extends Omit<FollowReport, 'partial'> {
  // absent when nothing loaded covers the anchor's window
  placement?: FollowWork | SpreadWork
  partial?: FollowReport['partial']
}

// from where and to where: the same target from another place is the follow
// re-asserting itself over a row the user has since dragged
function navSignature(
  from: FollowWindow | 'spread' | undefined,
  to: ResolvedSpan,
) {
  const here =
    from === 'spread'
      ? from
      : from
        ? `${from.refName}:${from.start}-${from.end}`
        : 'nowhere-yet'
  return `${here}>${to.refName}:${to.start}-${to.end}`
}

/**
 * Keep the non-anchor genome rows on the region that aligns to the anchor
 * row's window, and make a gesture on any followed row the anchor. See this
 * directory's CLAUDE.md.
 */
export function installSyntenyFollow(self: SyntenyFollowHost) {
  const levelStates = createFollowLevelStates<FollowLevel>()

  // under "same bp per pixel" a spread row draws no finer than the anchor
  const spreadFloor = () =>
    self.sameScale ? self.views[self.followAnchorIndex]?.bpPerPx : undefined

  addDisposer(
    self,
    addMiddleware(self, (call, next) => {
      if (
        call.type === 'action' &&
        call.id === call.rootId &&
        ROW_GESTURES.has(call.name)
      ) {
        // untracked, since the follow's own root actions come through here from
        // inside its autoruns; a row showing nothing yet is being initialized
        // eslint-disable-next-line no-restricted-syntax -- effect input: a gesture's row, read where an autorun may be the caller
        const row = untracked(() => {
          const idx = self.followSynteny ? self.views.indexOf(call.context) : -1
          return idx !== -1 &&
            self.views[idx]!.displayedRegions.length > 0 &&
            idx !== self.followAnchorIndex
            ? idx
            : -1
        })
        if (row !== -1) {
          self.setFollowAnchorIndex(row)
        }
      }
      next(call)
    }),
  )

  async function execute({
    level,
    movingView,
    step,
    staying,
    movingMinWidthBp,
    matchOrientation,
    anchorOrientation,
    seq,
    generation,
  }: FollowWork) {
    const state = levelStates.get(level)
    const stale = () =>
      seq !== state.seq ||
      generation !== levelStates.generation ||
      !isAlive(self) ||
      !isAlive(movingView) ||
      (staying !== undefined && !isAlive(staying.view))
    const { span, approximate } = await state.answer(step)
    if (stale() || !self.followSynteny) {
      return
    }
    // a walk collapsed to a point is not a place: the row holds, and the frame
    // pass with it
    if (span.end - span.start <= 0) {
      state.pick = undefined
      self.setFollowReport({ unaligned: true })
      return
    }
    state.lastErrorMessage = undefined
    // raised, never lowered: the plan owns the reset
    if (approximate) {
      self.setFollowReport({ approximate: true })
    }
    state.pick = {
      feat: step.feat,
      display: step.display,
      target: span.refName,
      transform: step.windowInsideFeat
        ? followTransform(step.window, span, step.feat.strand === -1)
        : undefined,
    }
    ensureCigarMap(state, step)
    // The staying row moved while the answer was in flight, so navigating
    // would send the row back to a window the staying row has left. A span
    // the row can show is left to the next frame of motion, which places
    // through the pick above, and to the settle the staying row's coarse
    // refresh brings. A span on a contig the row does not display is
    // navigated regardless, since nothing else reaches it.
    if (
      staying &&
      !sameWindows(
        followAnchorWindows(staying.view.dynamicBlocks.contentBlocks),
        staying.windows,
      ) &&
      spanBounds(movingView.displayedRegions, [span])
    ) {
      return
    }
    // off the live blocks: after a drag the coarse ones name where the row was
    // before the frame pass placed it
    const movingWindow = followAnchorWindow(
      movingView.dynamicBlocks.contentBlocks,
    )
    if (alreadyShowing(movingWindow, span, movingMinWidthBp)) {
      state.lastNav = undefined
    } else {
      // the backstop: the same target asked for from the same place twice
      // cannot be a real disagreement, and navigating wakes this pass
      const nav = navSignature(movingWindow, span)
      if (nav !== state.lastNav) {
        state.lastNav = nav
        await self.holdFollowAnchor(() => navToResolvedSpan(movingView, span))
        if (stale()) {
          return
        }
      }
    }
    // after the navigation, whose locstring fallback lands the row forward
    orient(state, step, matchOrientation, anchorOrientation, movingView)
  }

  // Rung 3's placement: one `moveTo` across the union, leaving the row's regions
  // alone, and no pick or orientation key, since no one block places the row.
  function executeSpread({ level, movingView, spans }: SpreadWork) {
    const state = levelStates.get(level)
    state.pick = undefined
    state.orientedKey = undefined
    const placed = self.holdFollowAnchor(() =>
      positionViewOnSpans(movingView, spans, spreadFloor()),
    )
    if (placed) {
      state.lastNav = undefined
      return
    }
    // the row displays none of the answer, so it goes to the widest span, and
    // the next pass places it
    const widest = spans.reduce((a, b) =>
      b.end - b.start > a.end - a.start ? b : a,
    )
    const nav = navSignature('spread', widest)
    if (nav !== state.lastNav) {
      state.lastNav = nav
      self
        .holdFollowAnchor(() => navToResolvedSpan(movingView, widest))
        .catch((e: unknown) => {
          reportError(level, e)
        })
    }
  }

  /**
   * Turn the moving row round when the alignment placing it runs the other
   * way, once per decision, so a row flipped by hand afterwards stands until the
   * decision changes. A mixed window or a mixed row decides nothing.
   */
  function orient(
    state: FollowLevelState,
    step: FollowStep,
    matchOrientation: boolean,
    anchorOrientation: RegionsOrientation,
    movingView: LinearGenomeViewModel,
  ) {
    if (!matchOrientation) {
      // dropped while off, so switching back on re-asserts
      state.orientedKey = undefined
      return
    }
    if (step.wantReversed === undefined) {
      return
    }
    const decision = step.envelope?.refName ?? step.feat.id
    const key = `${decision}|${step.wantReversed}|${anchorOrientation}`
    if (key === state.orientedKey) {
      return
    }
    const movingOrientation = movingView.displayedRegionsOrientation
    // not recorded, so a row that stops being mixed is decided then
    if (anchorOrientation === 'mixed' || movingOrientation === 'mixed') {
      return
    }
    state.orientedKey = key
    const anchorReversed = anchorOrientation === 'reversed'
    const movingReversed = movingOrientation === 'reversed'
    if (movingReversed !== (anchorReversed !== step.wantReversed)) {
      movingView.horizontallyFlip()
    }
  }

  // Fetch the pick's CIGAR map once, not awaited: a map that never arrives costs
  // the frame pass precision, not a placement, so a failure reports nothing.
  function ensureCigarMap(state: FollowLevelState, step: FollowStep) {
    const featureId = step.feat.id
    if (
      !step.hasCigar ||
      state.map?.featureId === featureId ||
      state.mapPending === featureId
    ) {
      return
    }
    state.mapPending = featureId
    const generation = levelStates.generation
    requestCigarMap({
      model: step.display,
      feat: step.feat,
      signal: levelStates.signal,
    })
      .then(value => {
        // not `seq`: a later window inside the same block still wants this
        if (generation === levelStates.generation) {
          state.map = { featureId, value }
        }
      })
      .catch(() => {
        // asked again next settle
      })
      .finally(() => {
        if (state.mapPending === featureId) {
          state.mapPending = undefined
        }
      })
  }

  function reportError(level: FollowLevel, e: unknown) {
    if (!isAlive(self)) {
      return
    }
    // once per message: `notifyError` bypasses the snackbar's own dedup
    const state = levelStates.get(level)
    const message = `${e}`
    if (message !== state.lastErrorMessage) {
      state.lastErrorMessage = message
      getNotificationSink(self).notifyError(message, e)
    }
  }

  /**
   * Rung 3: the plan when the row spreads, else the window the rung below
   * places it from. A carried spread is not re-judged, and the decision runs
   * before the carry, or `placed` hands the next level a refused union.
   */
  function planSpread({
    pair,
    windows,
    measured,
    state,
    placed,
  }: {
    pair: FollowPair
    windows: FollowWindow[]
    // absent for a carried level
    measured: AnchorWindow[] | undefined
    state: FollowLevelState
    placed: PlacedWindows
  }) {
    const { level, stayingView, movingView, toMate, mateAssembly } = pair
    const { spans, mapped } = followSpreadSpans({
      displays: level.linearSyntenyDisplays,
      windows,
      toMate,
      mateAssembly,
      incumbents: state.spreadTargets,
    })
    state.spreadTargets = mapped
    const decision =
      !measured || !spans.length
        ? { spreading: true }
        : decideSpread({
            stayingRegions: stayingView.displayedRegions,
            // eslint-disable-next-line no-restricted-syntax -- self-write: the placement this pass is about to make
            movingRegions: untracked(() => movingView.displayedRegions),
            windows: measured,
            spans,
            mapped,
            previous: state.spread,
          })
    state.spread = decision
    logFollowSpread({
      stayingView,
      movingView,
      windows,
      measured,
      spans,
      decision,
    })
    const rung = followRung(windows, decision)
    if (rung?.kind !== 'spread') {
      return { window: rung?.window }
    }
    if (spans.length) {
      placed.set(movingView, followPlacedWindows(spans))
    }
    return {
      plan: {
        placement: spans.length
          ? {
              kind: 'spread' as const,
              level,
              movingView,
              spans,
            }
          : undefined,
        unaligned:
          !spans.length && level.linearSyntenyDisplays.some(d => d.featureData),
        approximate: spans.length > 0,
        noSyntenyTrack: !level.linearSyntenyDisplays.length,
      } satisfies FollowPlan,
    }
  }

  // woken by the coarse blocks, read off the live ones, which mid-drag are where
  // the anchor is
  function settledWindows(row: LinearGenomeViewModel) {
    void row.coarseDynamicBlocks
    return followAnchorWindows(
      // eslint-disable-next-line no-restricted-syntax -- read for the window, which the coarse read above tracks
      untracked(() => row.dynamicBlocks.contentBlocks),
    )
  }

  // every observable a level's placement needs is read here, since `execute`
  // tracks nothing past its first `await`
  function planLevel(pair: FollowPair, placed: PlacedWindows): FollowPlan {
    const { level, stayingView, movingView, toMate, mateAssembly } = pair
    const state = levelStates.facing(level, toMate)
    // read unconditionally, so the checkbox is a dependency whatever the rung
    const matchOrientation = self.followMatchOrientation
    // bumped for every level visited, so a level that holds also drops what is
    // in flight
    const seq = ++state.seq
    const carried = placed.get(stayingView)
    const measured = carried ? undefined : settledWindows(stayingView)
    const windows = carried ?? measured ?? []
    const widest = windows[0]
    const noSyntenyTrack = !level.linearSyntenyDisplays.length
    // a decision about several contigs says nothing about one
    if (windows.length <= 1) {
      state.spread = undefined
    }
    if (!widest) {
      return { unaligned: false, approximate: false, noSyntenyTrack }
    }

    // the moving row is a dependency of every rung, which re-asserts the follow
    // over a row something other than a gesture moved
    void movingView.coarseDynamicBlocks

    const spread =
      windows.length > 1
        ? planSpread({
            pair,
            windows,
            measured,
            state,
            placed,
          })
        : undefined
    if (spread?.plan) {
      return spread.plan
    }
    const window = spread?.window ?? widest
    const step = planFollowStep({
      displays: level.linearSyntenyDisplays,
      window,
      toMate,
      mateAssembly,
      incumbentId: state.pick?.feat.id,
      incumbentTarget: state.pick?.target,
    })
    logFollowStep({
      stayingView,
      movingView,
      window,
      carried: !!carried,
      rung: step
        ? step.windowInsideFeat
          ? 'RUNG1 walk'
          : 'RUNG2 envelope'
        : 'HOLD',
      target: state.pick?.target,
    })
    return {
      placement: step && {
        kind: 'resolve',
        level,
        movingView,
        step,
        staying: carried ? undefined : { view: stayingView, windows },
        movingMinWidthBp: movingView.minBpPerPx * movingView.width,
        matchOrientation,
        anchorOrientation: stayingView.displayedRegionsOrientation,
        seq,
        generation: levelStates.generation,
      },
      // a level still fetching has no answer yet rather than no answer
      unaligned: !step && level.linearSyntenyDisplays.some(d => d.featureData),
      approximate:
        !!step &&
        (!step.windowInsideFeat ||
          !step.hasCigar ||
          step.display.coarseWalkIsApproximate),
      noSyntenyTrack,
      partial:
        state.spread?.spreading === false &&
        state.spread.onto &&
        state.spread.elsewhere?.length
          ? {
              following: state.spread.onto,
              elsewhere: state.spread.elsewhere ?? [],
            }
          : undefined,
    }
  }

  // aborts a CIGAR map in flight when the view closes
  addDisposer(self, () => {
    levelStates.clear()
  })
  addDisposer(
    self,
    autorun(
      function syntenyFollowAutorun() {
        if (!self.followSynteny) {
          self.setFollowReport(EMPTY_FOLLOW_REPORT)
          levelStates.clear()
          return
        }
        const placed: PlacedWindows = new Map()
        const plans = self.followPairs.map(pair => planLevel(pair, placed))
        self.setFollowReport({
          unaligned: plans.some(p => p.unaligned),
          approximate: plans.some(p => p.approximate),
          noSyntenyTrack: plans.some(p => p.noSyntenyTrack),
          partial: plans.find(p => p.partial)?.partial,
        })
        // untracked: `execute` runs synchronously up to its first `await`, and
        // the resolve reads `lodTier`, which the frame pass moves every frame
        // eslint-disable-next-line no-restricted-syntax -- effect input: execute consumes the display's adapterConfig and lodTier, the plans are the decision
        untracked(() => {
          for (const { placement } of plans) {
            if (placement?.kind === 'spread') {
              executeSpread(placement)
            } else if (placement) {
              execute(placement).catch((e: unknown) => {
                reportError(placement.level, e)
              })
            }
          }
        })
      },
      { name: 'SyntenyFollow' },
    ),
  )

  // the settle's rule, for a level the frame pass reaches with several windows
  // and no decision, recorded so the rest of the drag keeps it
  function decideFrameSpread(
    pair: FollowPair,
    windows: AnchorWindow[],
    { spans, mapped }: ReturnType<typeof followSpreadSpans>,
  ) {
    const decision = spans.length
      ? decideSpread({
          // eslint-disable-next-line no-restricted-syntax -- read for the decision, which the blocks the windows came off already track
          stayingRegions: untracked(() => pair.stayingView.displayedRegions),
          // eslint-disable-next-line no-restricted-syntax -- self-write: the row this pass places
          movingRegions: untracked(() => pair.movingView.displayedRegions),
          windows,
          spans,
          mapped,
        })
      : { spreading: true }
    levelStates.facing(pair.level, pair.toMate).spread = decision
    return decision
  }

  // The frame pass replans against the live window. It reads each level's
  // staying row, untracked once this run has written it, and never its moving
  // row.
  addDisposer(
    self,
    autorun(
      function syntenyFollowFrameAutorun() {
        if (!self.followSynteny) {
          return
        }
        const written = new Set<LinearGenomeViewModel>()
        const placed: PlacedWindows = new Map()
        for (const pair of self.followPairs) {
          const { level, stayingView, movingView, toMate, mateAssembly } = pair
          const carried = placed.get(stayingView)
          const measured = carried
            ? undefined
            : followAnchorWindows(
                written.has(stayingView)
                  ? // eslint-disable-next-line no-restricted-syntax -- self-write: this pass wrote that row
                    untracked(() => stayingView.dynamicBlocks.contentBlocks)
                  : stayingView.dynamicBlocks.contentBlocks,
              )
          const windows = carried ?? measured ?? []
          const state = levelStates.peek(level, toMate)
          let spreadSpans: ReturnType<typeof followSpreadSpans> | undefined
          const spreadAnswer = () =>
            (spreadSpans ??= followSpreadSpans({
              displays: level.linearSyntenyDisplays,
              windows,
              toMate,
              mateAssembly,
              incumbents: state?.spreadTargets,
            }))
          // rung 3's answer is recomputed per frame; whether to take the rung is
          // decided once and kept
          const decision =
            state?.spread ??
            (measured && measured.length > 1
              ? decideFrameSpread(pair, measured, spreadAnswer())
              : undefined)
          const rung = followRung(windows, decision)
          if (!rung) {
            continue
          }
          // hiding a synteny track destroys the pick's display
          const pick = state?.pick
          if (rung.kind === 'spread' || (decision?.spreading && !pick)) {
            const { spans, mapped } = spreadAnswer()
            levelStates.facing(level, toMate).spreadTargets = mapped
            if (spans.length) {
              placed.set(movingView, followPlacedWindows(spans))
              self.holdFollowAnchor(() =>
                positionViewOnSpans(movingView, spans, spreadFloor()),
              )
            }
            continue
          }
          const { window } = rung
          if (!pick || !isAlive(pick.display)) {
            continue
          }
          const data = pick.display.featureData
          if (!data) {
            continue
          }
          const span = followFrameSpan({
            feat: pick.feat,
            data,
            window,
            toMate,
            mateAssembly,
            transform: pick.transform,
            map:
              state.map?.featureId === pick.feat.id
                ? state.map.value
                : undefined,
            incumbentTarget: pick.target,
          })
          if (
            span &&
            self.holdFollowAnchor(() => positionViewOnSpan(movingView, span))
          ) {
            written.add(movingView)
          }
        }
      },
      { name: 'SyntenyFollowFrame' },
    ),
  )
}

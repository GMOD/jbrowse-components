import { getConf, readConfObject } from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import {
  getEnv,
  getSession,
  isAbortException,
  isSessionModelWithWidgets,
  saveAs,
  statusMessageText,
} from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { orderCandidates } from '../candidates/order.ts'
import { createReviewKeyHandler } from '../commands/keyboardAdapter.ts'
import { resolveKeymap } from '../commands/keymap.ts'
import { runReviewCommand } from '../commands/registry.ts'
import { DEFAULT_REVIEW_CONFIG } from '../configSchema.ts'
import { decisionsTsv } from '../export/decisionsTsv.ts'
import { reviewWindow } from './reviewWindow.ts'
import { findReviewTargets, trackOnAssembly } from './targets.ts'

import type {
  CandidateId,
  CandidateVariant,
  DecisionRecord,
  ReviewDecision,
} from '../candidates/types.ts'
import type { ResolvedKeymap } from '../commands/keymap.ts'
import type { ReviewConfig } from '../configSchema.ts'
import type {
  ReviewHostTrack,
  SortableAlignmentsDisplay,
  SortedByLike,
} from './targets.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ParsedLocString, Region } from '@jbrowse/core/util'
import type { RpcStatus } from '@jbrowse/core/util/progress'
import type { IAnyModelType, IStateTreeNode } from '@jbrowse/mobx-state-tree'

export const VARIANT_TRACK_TYPE = 'VariantTrack'
export const REVIEW_WIDGET_TYPE = 'VariantReviewWidget'
export const REVIEW_SCHEMA_VERSION = 1

/** What a display looked like before review first sorted it. */
export interface PriorDisplayState {
  sortedBy?: SortedByLike
  layoutOrder: string
}

export type CandidatesState = 'idle' | 'loading' | 'ready' | 'error'

/** How the last sort over the targets went, for the widget's status line. */
export interface SortReport {
  sorted: number
  total: number
  // why nothing was sorted when nothing was, e.g. a symbolic allele
  reason?: string
}

/**
 * The slice of `LinearGenomeView` review reads. Duck-typed so the extension
 * can be composed onto a stub in tests; the real view has all of it.
 */
export interface ReviewHostView extends IStateTreeNode {
  id: string
  tracks: ReviewHostTrack[]
  assemblyNames: string[]
  initialized: boolean
  displayedRegions: {
    refName: string
    start: number
    end: number
    assemblyName: string
  }[]
  navTo(location: Required<Omit<ParsedLocString, 'reversed'>>): void
  navToLocations(
    regions: ParsedLocString[],
    assemblyName?: string,
  ): Promise<unknown>
}

interface VariantDisplayLike {
  configuredFilters?: () => string[]
  selectFeatureById?: (
    featureId: string,
    subfeatureInfo: undefined,
    displayedRegionIndex: number,
  ) => void
}

/**
 * The review surface of a reviewing `LinearGenomeView`, as the widget, the
 * overlay and the commands see it.
 */
export interface VariantReviewView extends ReviewHostView {
  reviewSchemaVersion: number
  reviewTrackId: string | undefined
  reviewCursorId: CandidateId | undefined
  reviewSpanBp: number | undefined
  reviewDecisions: Map<CandidateId, DecisionRecord>
  reviewPriorDisplayState: Map<string, PriorDisplayState>

  candidates: CandidateVariant[]
  candidatesState: CandidatesState
  candidatesError: unknown
  candidatesTruncated: boolean
  candidatesDuplicates: number
  candidatesStatus: string
  navToken: number
  lastSortReport: SortReport | undefined
  windowExceeded: boolean

  reviewActive: boolean
  reviewConfig: ReviewConfig
  reviewKeymap: ResolvedKeymap
  reviewTrack: ReviewHostTrack | undefined
  variantTracks: ReviewHostTrack[]
  reviewTargets: SortableAlignmentsDisplay[]
  candidateCount: number
  candidateIndex: number
  currentCandidate: CandidateVariant | undefined
  currentDecision: DecisionRecord | undefined
  decisionCounts: {
    accepted: number
    rejected: number
    flagged: number
    unreviewed: number
  }

  startReview(trackId: string): Promise<void>
  stopReview(): void
  refreshCandidates(): Promise<void>
  gotoCandidate(index: number): void
  gotoCandidateId(id: CandidateId): void
  nextCandidate(): void
  previousCandidate(): void
  nextUnreviewed(): void
  restoreReviewViewport(): void
  sortTargetsAtCandidate(): void
  setDecision(decision: ReviewDecision): void
  clearDecision(): void
  setDecisionNote(note: string): void
  setReviewSpanBp(span?: number): void
  showCandidateDetails(): void
  exportDecisions(): void
}

/**
 * The plugin config, or the defaults when the session carries none (an
 * embedder, a test). Read slot by slot from the live node, which resolves
 * defaults; a snapshot omits them.
 */
export function readReviewConfig(session: unknown): ReviewConfig {
  const conf = (
    session as { configuration?: Record<string, AnyConfigurationModel> }
  ).configuration?.VariantReviewPlugin
  if (!conf) {
    return DEFAULT_REVIEW_CONFIG
  }
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(DEFAULT_REVIEW_CONFIG)) {
    out[key] =
      readConfObject(conf, key) ??
      DEFAULT_REVIEW_CONFIG[key as keyof ReviewConfig]
  }
  return out as unknown as ReviewConfig
}

function notify(
  node: IStateTreeNode,
  message: string,
  level: 'info' | 'warning' | 'error' | 'success' = 'info',
) {
  getSession(node).notify(message, level)
}

/**
 * #stateModel VariantReviewViewExtension
 * #category view
 * The review state a `LinearGenomeView` gains from this plugin: which variant
 * track is being reviewed, the cursor, and the decisions, all keyed by
 * candidate id so they survive navigation, refetch and reload. The candidate
 * list itself is volatile: it can run to 10^5 entries and the session's undo
 * history snapshots the whole session.
 *
 * Composed onto any model type so tests can stand a stub in for the view;
 * `ReviewHostView` is what it reads off the real one.
 *
 * #example
 * A `LinearGenomeView` in a session, part-way through reviewing a call set;
 * opening it resumes at the cursor with the decisions intact:
 * ```js
 * {
 *   type: 'LinearGenomeView',
 *   reviewTrackId: 'volvox_filtered_vcf',
 *   reviewCursorId: 'volvox:ctgA:3858:CTT:CT',
 *   reviewDecisions: {
 *     'volvox:ctgA:277:T:C': { decision: 'accepted' },
 *     'volvox:ctgA:1694:T:C': { decision: 'flagged', note: 'strand bias' },
 *   },
 * }
 * ```
 */
export function withVariantReview<T extends IAnyModelType>(base: T) {
  return base
    .props({
      /**
       * #property
       * bumped if the shape of the review props below ever changes
       */
      reviewSchemaVersion: types.optional(
        types.literal(REVIEW_SCHEMA_VERSION),
        REVIEW_SCHEMA_VERSION,
      ),
      /**
       * #property
       * the trackId of the VariantTrack under review; unset when not reviewing
       */
      reviewTrackId: types.maybe(types.string),
      /**
       * #property
       * the current candidate's id, not its index, so a refetch that changes
       * the list keeps the cursor on the same record
       */
      reviewCursorId: types.maybe(types.string),
      /**
       * #property
       * overrides the plugin config's `reviewSpanBp` when set
       */
      reviewSpanBp: types.maybe(types.number),
      /**
       * #property
       * candidate id to decision; an unreviewed candidate is absent
       */
      reviewDecisions: types.map(types.frozen<DecisionRecord>()),
      /**
       * #property
       * display id to its sort before review first touched it, restored on
       * stop
       */
      reviewPriorDisplayState: types.map(types.frozen<PriorDisplayState>()),
    })
    .volatile(() => ({
      candidates: [] as CandidateVariant[],
      candidatesState: 'idle' as CandidatesState,
      candidatesError: undefined as unknown,
      candidatesTruncated: false,
      candidatesDuplicates: 0,
      candidatesStatus: '',
      navToken: 0,
      // the token of the last navigation to land, so a late async one can
      // tell it has clobbered a newer one
      settledNavToken: 0,
      abortController: undefined as AbortController | undefined,
      // where the cursor was, to recover to the next record after it when a
      // refetch drops the current one
      lastLocus: undefined as { refName: string; start: number } | undefined,
      lastSortReport: undefined as SortReport | undefined,
      windowExceeded: false,
      // a refName's index among the assembly's regions, for ordering
      refOrder: new Map<string, number>(),
    }))
    .views(self => {
      const s = self as unknown as VariantReviewView
      return {
        /**
         * #getter
         */
        get reviewActive() {
          return s.reviewTrackId !== undefined
        },
        /**
         * #getter
         */
        get reviewConfig(): ReviewConfig {
          return readReviewConfig(getSession(self))
        },
        /**
         * #getter
         */
        get variantTracks() {
          const { assemblyManager } = getSession(self)
          const assemblyName = s.assemblyNames[0]
          return s.tracks.filter(
            t =>
              t.type === VARIANT_TRACK_TYPE &&
              trackOnAssembly(t, assemblyName, assemblyManager),
          )
        },
        /**
         * #getter
         * the track under review, or undefined when it has left the view
         */
        get reviewTrack() {
          return s.tracks.find(t => t.configuration.trackId === s.reviewTrackId)
        },
        /**
         * #getter
         */
        get candidateIndexMap() {
          return new Map(s.candidates.map((c, i) => [c.id, i]))
        },
        /**
         * #getter
         */
        get candidateCount() {
          return s.candidates.length
        },
      }
    })
    .views(self => {
      const s = self as unknown as VariantReviewView & {
        candidateIndexMap: Map<CandidateId, number>
      }
      return {
        /**
         * #getter
         */
        get reviewKeymap() {
          return resolveKeymap(s.reviewConfig.shortcuts)
        },
        /**
         * #getter
         * the alignments displays a sort goes to
         */
        get reviewTargets() {
          return findReviewTargets({
            tracks: s.tracks,
            assemblyName: s.assemblyNames[0],
            assemblyManager: getSession(self).assemblyManager,
            targetTrackIds: s.reviewConfig.targetTrackIds,
          })
        },
        /**
         * #getter
         * -1 when there is no cursor or it is not in the list
         */
        get candidateIndex() {
          return s.reviewCursorId === undefined
            ? -1
            : (s.candidateIndexMap.get(s.reviewCursorId) ?? -1)
        },
      }
    })
    .views(self => {
      const s = self as unknown as VariantReviewView
      return {
        /**
         * #getter
         */
        get currentCandidate() {
          return s.candidateIndex >= 0
            ? s.candidates[s.candidateIndex]
            : undefined
        },
        /**
         * #getter
         */
        get decisionCounts() {
          let accepted = 0
          let rejected = 0
          let flagged = 0
          let unreviewed = 0
          for (const c of s.candidates) {
            const d = s.reviewDecisions.get(c.id)?.decision
            if (d === 'accepted') {
              accepted++
            } else if (d === 'rejected') {
              rejected++
            } else if (d === 'flagged') {
              flagged++
            } else {
              unreviewed++
            }
          }
          return { accepted, rejected, flagged, unreviewed }
        },
      }
    })
    .views(self => {
      const s = self as unknown as VariantReviewView
      return {
        /**
         * #getter
         */
        get currentDecision() {
          const c = s.currentCandidate
          return c ? s.reviewDecisions.get(c.id) : undefined
        },
      }
    })
    .actions(self => {
      const s = self as unknown as VariantReviewView & {
        settledNavToken: number
        abortController: AbortController | undefined
        lastLocus: { refName: string; start: number } | undefined
        refOrder: Map<string, number>
      }

      function rememberPrior(d: SortableAlignmentsDisplay) {
        if (!s.reviewPriorDisplayState.has(d.id)) {
          const { sortedBy, layoutOrder } = d
          s.reviewPriorDisplayState.set(d.id, {
            sortedBy: sortedBy
              ? {
                  type: sortedBy.type,
                  pos: sortedBy.pos,
                  refName: sortedBy.refName,
                  ...(sortedBy.tag === undefined ? {} : { tag: sortedBy.tag }),
                }
              : undefined,
            layoutOrder,
          })
        }
      }

      return {
        setCandidatesLoading(controller: AbortController) {
          self.abortController = controller
          self.candidatesState = 'loading'
          self.candidatesError = undefined
          self.candidatesStatus = ''
        },
        setCandidatesStatus(status: string) {
          self.candidatesStatus = status
        },
        setCandidatesError(error: unknown) {
          self.candidatesState = 'error'
          self.candidatesError = error
          self.candidatesStatus = ''
        },
        setRefOrder(refOrder: Map<string, number>) {
          self.refOrder = refOrder
        },
        /**
         * #action
         * a fetched list, in genomic order
         */
        setCandidates(
          candidates: CandidateVariant[],
          truncated = false,
          duplicates = 0,
        ) {
          self.candidates = orderCandidates(candidates, s.refOrder)
          self.candidatesTruncated = truncated
          self.candidatesDuplicates = duplicates
          self.candidatesState = 'ready'
          self.candidatesStatus = ''
        },
        /**
         * #action
         * sort every target display at a candidate's column, recording each
         * display's prior sort the first time review touches it. A display
         * that throws is counted and skipped; it never stops the others.
         */
        sortTargetsAt(c: CandidateVariant) {
          const targets = s.reviewTargets
          const { sort } = c
          if (!sort) {
            self.lastSortReport = {
              sorted: 0,
              total: targets.length,
              reason: `no sort for ${c.kind} allele`,
            }
            return
          }
          let sorted = 0
          for (const d of targets) {
            try {
              rememberPrior(d)
              d.setSortedByAtPosition({
                type: sort.type,
                pos: sort.pos,
                refName: c.refName,
              })
              sorted++
            } catch (e) {
              console.error(e)
            }
          }
          self.lastSortReport = { sorted, total: targets.length }
        },
        setSettledNavToken(token: number) {
          self.settledNavToken = token
        },
        setWindowExceeded(exceeded: boolean) {
          self.windowExceeded = exceeded
        },
      }
    })
    .actions(self => {
      const s = self as unknown as VariantReviewView & {
        settledNavToken: number
        setSettledNavToken(token: number): void
        setWindowExceeded(exceeded: boolean): void
        sortTargetsAt(c: CandidateVariant): void
      }
      return {
        /**
         * #action
         * move the viewport to a candidate. Synchronous when the window lies
         * in a displayed region; otherwise through `navToLocations`, whose
         * late arrival is dropped if a newer navigation has landed meanwhile,
         * and re-run if it clobbered one.
         */
        navigateToCandidate(c: CandidateVariant, token: number) {
          const span = s.reviewSpanBp ?? s.reviewConfig.reviewSpanBp
          const w = reviewWindow(c, span, s.reviewConfig.maxReviewWindowBp)
          s.setWindowExceeded(w.exceeded)
          const location = {
            refName: c.refName,
            start: w.start,
            end: w.end,
            assemblyName: c.assemblyName,
          }
          try {
            s.navTo(location)
            s.setSettledNavToken(token)
          } catch {
            s.navToLocations([location], c.assemblyName).then(
              () => {
                if (isAlive(self)) {
                  ;(
                    self as unknown as {
                      afterAsyncNavigation(token: number): void
                    }
                  ).afterAsyncNavigation(token)
                }
              },
              (e: unknown) => {
                if (isAlive(self)) {
                  console.error(e)
                  notify(self, `Could not navigate: ${e}`, 'error')
                }
              },
            )
          }
        },
        afterAsyncNavigation(token: number) {
          const current = s.currentCandidate
          if (token === s.navToken) {
            s.setSettledNavToken(token)
            // a display rebuilt by the region change would have missed the
            // sort written before it
            if (current && s.reviewConfig.autoSortOnNavigate) {
              s.sortTargetsAt(current)
            }
          } else if (current && s.settledNavToken === s.navToken) {
            // a stale navigation landed after the current one: go back
            this.navigateToCandidate(current, s.navToken)
          }
        },
      }
    })
    .actions(self => {
      const s = self as unknown as VariantReviewView & {
        navToken: number
        lastLocus: { refName: string; start: number } | undefined
        navigateToCandidate(c: CandidateVariant, token: number): void
        sortTargetsAt(c: CandidateVariant): void
      }
      return {
        /**
         * #action
         * the cursor, the sort and the viewport in one action: sort first, so
         * the relayout that follows the fetch already has it
         */
        gotoCandidate(index: number) {
          const n = s.candidates.length
          if (n === 0) {
            return
          }
          if (index < 0) {
            notify(self, 'First candidate')
            return
          }
          if (index >= n) {
            notify(self, 'Last candidate')
            return
          }
          const c = s.candidates[index]!
          s.reviewCursorId = c.id
          s.lastLocus = { refName: c.refName, start: c.start }
          s.navToken += 1
          const token = s.navToken
          if (s.reviewConfig.autoSortOnNavigate) {
            s.sortTargetsAt(c)
          }
          s.navigateToCandidate(c, token)
        },
      }
    })
    .actions(self => {
      const s = self as unknown as VariantReviewView & {
        navToken: number
        navigateToCandidate(c: CandidateVariant, token: number): void
        sortTargetsAt(c: CandidateVariant): void
        candidateIndexMap: Map<CandidateId, number>
      }
      return {
        /**
         * #action
         */
        gotoCandidateId(id: CandidateId) {
          const i = s.candidateIndexMap.get(id)
          if (i !== undefined) {
            s.gotoCandidate(i)
          }
        },
        /**
         * #action
         */
        nextCandidate() {
          s.gotoCandidate(s.candidateIndex + 1)
        },
        /**
         * #action
         */
        previousCandidate() {
          s.gotoCandidate(s.candidateIndex - 1)
        },
        /**
         * #action
         * the next candidate with no decision, wrapping once
         */
        nextUnreviewed() {
          const n = s.candidates.length
          for (let step = 1; step <= n; step++) {
            const i = (s.candidateIndex + step + n) % n
            if (!s.reviewDecisions.has(s.candidates[i]!.id)) {
              s.gotoCandidate(i)
              return
            }
          }
          notify(self, 'Every candidate has a decision')
        },
        /**
         * #action
         * re-centre on the current candidate, without re-sorting
         */
        restoreReviewViewport() {
          const c = s.currentCandidate
          if (c) {
            s.navToken += 1
            s.navigateToCandidate(c, s.navToken)
          }
        },
        /**
         * #action
         * re-sort every target at the current candidate, e.g. after a manual
         * re-sort
         */
        sortTargetsAtCandidate() {
          const c = s.currentCandidate
          if (c) {
            s.sortTargetsAt(c)
          }
        },
        /**
         * #action
         * with `advanceOnDecide`, also moves on, in the same action so one
         * undo step covers both
         */
        setDecision(decision: ReviewDecision) {
          const c = s.currentCandidate
          if (!c) {
            return
          }
          const prior = s.reviewDecisions.get(c.id)
          s.reviewDecisions.set(c.id, {
            decision,
            ...(prior?.note ? { note: prior.note } : {}),
            ...(s.reviewConfig.recordTimestamps
              ? { timestamp: new Date().toISOString() }
              : {}),
          })
          if (s.reviewConfig.advanceOnDecide) {
            this.nextCandidate()
          }
        },
        /**
         * #action
         */
        clearDecision() {
          const c = s.currentCandidate
          if (c) {
            s.reviewDecisions.delete(c.id)
          }
        },
        /**
         * #action
         * a note on the current candidate's decision; a candidate with no
         * decision yet is flagged, since a note is a reason to come back
         */
        setDecisionNote(note: string) {
          const c = s.currentCandidate
          if (!c) {
            return
          }
          const prior = s.reviewDecisions.get(c.id)
          const { note: _old, ...rest } = prior ?? {
            decision: 'flagged' as const,
          }
          s.reviewDecisions.set(c.id, note ? { ...rest, note } : rest)
        },
        /**
         * #action
         */
        setReviewSpanBp(span?: number) {
          s.reviewSpanBp = span
        },
        /**
         * #action
         * open the feature details for the current candidate through the
         * variant display, which fetches the full record only now rather than
         * on every move
         */
        showCandidateDetails() {
          const c = s.currentCandidate
          const display = s.reviewTrack?.displays.find(
            d =>
              typeof (d as VariantDisplayLike).selectFeatureById === 'function',
          ) as VariantDisplayLike | undefined
          const regionIndex = s.displayedRegions.findIndex(
            r =>
              r.refName === c?.refName && r.start <= c.start && r.end > c.start,
          )
          if (c && display?.selectFeatureById && regionIndex >= 0) {
            display.selectFeatureById(c.sourceFeatureId, undefined, regionIndex)
          } else {
            notify(self, 'No feature details available for this candidate')
          }
        },
        /**
         * #action
         */
        exportDecisions() {
          const track = s.reviewTrack
          const name = track
            ? getTrackName(track.configuration, getSession(self))
            : 'variants'
          saveAs(
            new Blob([decisionsTsv(s.candidates, s.reviewDecisions)], {
              type: 'text/tab-separated-values',
            }),
            `${name.replaceAll(/[^\w.-]+/g, '_')}-review.tsv`,
          )
        },
      }
    })
    .actions(self => {
      const s = self as unknown as VariantReviewView & {
        abortController: AbortController | undefined
        lastLocus: { refName: string; start: number } | undefined
        refOrder: Map<string, number>
        setCandidatesLoading(c: AbortController): void
        setCandidatesStatus(status: string): void
        setCandidatesError(e: unknown): void
        setCandidates(
          c: CandidateVariant[],
          truncated?: boolean,
          duplicates?: number,
        ): void
        setRefOrder(m: Map<string, number>): void
      }
      return {
        /**
         * #action
         * re-derive the candidate list from the track's adapter in the
         * worker, aborting any fetch in flight. A cursor whose record is gone
         * moves to the next record after where it was.
         */
        async refreshCandidates() {
          s.abortController?.abort()
          const controller = new AbortController()
          s.setCandidatesLoading(controller)
          const { signal } = controller
          try {
            const track = s.reviewTrack
            if (!track) {
              throw new Error(`track "${s.reviewTrackId}" is not in this view`)
            }
            const session = getSession(self)
            const { assemblyManager, rpcManager } = session
            const viewAssembly = s.assemblyNames[0]
            if (!viewAssembly) {
              throw new Error('view has no assembly')
            }
            const assembly = await assemblyManager.waitForAssembly(viewAssembly)
            if (!assembly?.regions) {
              throw new Error(`assembly "${viewAssembly}" has no regions`)
            }
            const assemblyName = assembly.name
            const regions: Region[] = assembly.regions.map(r => ({
              refName: r.refName,
              start: r.start,
              end: r.end,
              assemblyName,
            }))
            const filters = track.displays
              .map(d => (d as VariantDisplayLike).configuredFilters?.())
              .find(f => f !== undefined)
            const { pluginManager } = getEnv(self)
            const config = s.reviewConfig
            const result = await rpcManager.call(
              (track as unknown as { rpcSessionId: string }).rpcSessionId,
              'VariantReviewGetCandidates',
              {
                adapterConfig: getConf(track, 'adapter'),
                regions,
                canonicalRefNames: regions.map(r => r.refName),
                assemblyName,
                infoFields: config.infoFields,
                maxCandidates: config.maxCandidates,
                filters:
                  filters && filters.length > 0
                    ? new SerializableFilterChain({
                        filters,
                        jexl: pluginManager.jexl,
                      })
                    : undefined,
                signal,
                statusCallback: (status: RpcStatus) => {
                  if (isAlive(self) && !signal.aborted) {
                    s.setCandidatesStatus(statusMessageText(status) ?? '')
                  }
                },
              },
            )
            if (signal.aborted || !isAlive(self)) {
              return
            }
            s.setRefOrder(new Map(regions.map((r, i) => [r.refName, i])))
            s.setCandidates(
              result.candidates,
              result.truncated,
              result.duplicates,
            )
            if (result.truncated) {
              notify(
                self,
                `Candidate list truncated at ${config.maxCandidates.toLocaleString()} records — filter the track or load a smaller call set`,
                'warning',
              )
            }
            if (result.duplicates > 0) {
              notify(
                self,
                `${result.duplicates} duplicate variant record(s) were given suffixed ids`,
                'warning',
              )
            }
            ;(self as unknown as { recoverCursor(): void }).recoverCursor()
          } catch (e) {
            if (!isAbortException(e) && isAlive(self) && !signal.aborted) {
              console.error(e)
              s.setCandidatesError(e)
            }
          }
        },
        recoverCursor() {
          const id = s.reviewCursorId
          const last = s.lastLocus
          if (id === undefined || s.candidateIndex >= 0 || !last) {
            return
          }
          const rank = (refName: string) =>
            s.refOrder.get(refName) ?? Number.MAX_SAFE_INTEGER
          const next = s.candidates.find(
            c =>
              rank(c.refName) > rank(last.refName) ||
              (c.refName === last.refName && c.start > last.start),
          )
          notify(self, 'Candidate no longer in list — moved to next')
          if (next) {
            s.gotoCandidateId(next.id)
          } else {
            s.reviewCursorId = undefined
          }
        },
      }
    })
    .actions(self => {
      const s = self as unknown as VariantReviewView & {
        abortController: AbortController | undefined
      }
      return {
        openReviewWidget() {
          const session = getSession(self)
          if (isSessionModelWithWidgets(session)) {
            const widget = session.addWidget(
              REVIEW_WIDGET_TYPE,
              `${REVIEW_WIDGET_TYPE}-${s.id}`,
              { view: s.id },
            )
            session.showWidget(widget)
          }
        },
        /**
         * #action
         * review a VariantTrack shown in this view. Decisions from an earlier
         * review stay: they are keyed by candidate, not by track
         */
        async startReview(trackId: string) {
          const track = s.variantTracks.find(
            t => t.configuration.trackId === trackId,
          )
          if (!track) {
            notify(
              self,
              `Track "${trackId}" is not a variant track shown in this view on its assembly`,
              'error',
            )
            return
          }
          if (s.reviewTrackId !== undefined && s.reviewTrackId !== trackId) {
            notify(
              self,
              `Review switched to ${getTrackName(track.configuration, getSession(self))}; decisions so far are kept`,
            )
            s.reviewCursorId = undefined
          }
          for (const d of s.reviewTargets) {
            if (!s.reviewPriorDisplayState.has(d.id)) {
              const { sortedBy, layoutOrder } = d
              s.reviewPriorDisplayState.set(d.id, { sortedBy, layoutOrder })
            }
          }
          s.reviewTrackId = trackId
          ;(self as unknown as { openReviewWidget(): void }).openReviewWidget()
          await s.refreshCandidates()
          if (!isAlive(self) || s.reviewTrackId !== trackId) {
            return
          }
          if (s.candidateIndex >= 0) {
            s.gotoCandidate(s.candidateIndex)
          } else {
            const first = s.candidates.findIndex(
              c => !s.reviewDecisions.has(c.id),
            )
            s.gotoCandidate(first >= 0 ? first : 0)
          }
        },
        /**
         * #action
         * leave review, putting each display's sort back when
         * `restoreSortOnExit` says so. Decisions are kept: stopping must never
         * lose work.
         */
        stopReview() {
          s.abortController?.abort()
          if (s.reviewConfig.restoreSortOnExit) {
            const byId = new Map(
              findReviewTargets({
                tracks: s.tracks,
                assemblyName: s.assemblyNames[0],
                assemblyManager: getSession(self).assemblyManager,
                targetTrackIds: [],
              }).map(d => [d.id, d]),
            )
            for (const [id, prior] of s.reviewPriorDisplayState) {
              const d = byId.get(id)
              try {
                if (prior.sortedBy) {
                  d?.setSortedByAtPosition(prior.sortedBy)
                } else {
                  d?.setLayoutOrder(prior.layoutOrder)
                }
              } catch (e) {
                console.error(e)
              }
            }
          }
          s.reviewPriorDisplayState.clear()
          s.reviewTrackId = undefined
          s.candidates = []
          s.candidatesState = 'idle'
          s.lastSortReport = undefined
        },
      }
    })
    .actions(self => {
      const s = self as unknown as VariantReviewView & {
        candidatesState: CandidatesState
      }
      return {
        afterAttach() {
          if (typeof document === 'undefined') {
            return
          }
          let warnedKeymap = false
          const handler = createReviewKeyHandler({
            isActive: () =>
              isAlive(self) &&
              s.reviewActive &&
              getSession(self).focusedViewId === s.id,
            bindings: () => s.reviewKeymap.bindings,
            run: id => runReviewCommand(id, s),
          })
          let listening = false
          addDisposer(
            self,
            autorun(
              function variantReviewKeyboardAutorun() {
                const active = s.reviewActive
                if (active && !listening) {
                  document.addEventListener('keydown', handler)
                  listening = true
                  const { problems } = s.reviewKeymap
                  if (problems.length > 0 && !warnedKeymap) {
                    warnedKeymap = true
                    notify(
                      self,
                      `Variant review shortcuts: ${problems.join('; ')}`,
                      'warning',
                    )
                  }
                } else if (!active && listening) {
                  document.removeEventListener('keydown', handler)
                  listening = false
                }
              },
              { name: 'VariantReviewKeyboard' },
            ),
          )
          addDisposer(self, () => {
            document.removeEventListener('keydown', handler)
          })
          // a session reloaded mid-review has its decisions and cursor but no
          // list, which is volatile: fetch it once the view can say where it
          // is, without moving the view
          addDisposer(
            self,
            autorun(
              function variantReviewReloadAutorun() {
                if (
                  s.reviewActive &&
                  s.initialized &&
                  s.candidatesState === 'idle' &&
                  s.reviewTrack
                ) {
                  void s.refreshCandidates()
                }
              },
              { name: 'VariantReviewReload' },
            ),
          )
        },
      }
    })
}

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { onSnapshot, types } from '@jbrowse/mobx-state-tree'

import configSchema from '../configSchema.ts'
import { withVariantReview } from './model.ts'

import type { CandidateVariant } from '../candidates/types.ts'
import type { VariantReviewView } from './model.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// A stub of the slice of LinearGenomeView, alignments and variant displays the
// review extension drives, in the `makeModel` spirit of the alignments sort
// menu tests: enough MST to compose the extension onto, nothing rendered.

const TrackConfig = ConfigurationSchema(
  'StubTrack',
  {
    adapter: { type: 'frozen', defaultValue: { type: 'StubAdapter' } },
    assemblyNames: { type: 'stringArray', defaultValue: ['volvox'] },
    name: { type: 'string', defaultValue: '' },
  },
  { explicitIdentifier: 'trackId' },
)

const AlignmentsDisplay = types
  .model('StubAlignmentsDisplay', {
    id: types.identifier,
    type: types.literal('LinearAlignmentsDisplay'),
    sortedBy: types.frozen<
      { type: string; pos: number; refName: string } | undefined
    >(),
    layoutOrder: types.optional(types.string, 'position'),
    throws: false,
  })
  .actions(self => ({
    setSortedByAtPosition(s: { type: string; pos: number; refName: string }) {
      if (self.throws) {
        throw new Error('CRAM reference missing')
      }
      self.sortedBy = s
      self.layoutOrder = 'position'
    },
    setLayoutOrder(o: string) {
      self.layoutOrder = o
      self.sortedBy = undefined
    },
  }))

const VariantDisplay = types
  .model('StubVariantDisplay', {
    id: types.identifier,
    type: types.literal('LinearVariantDisplay'),
  })
  .volatile(() => ({ selected: [] as unknown[][] }))
  .actions(self => ({
    configuredFilters: () => [] as string[],
    selectFeatureById(...args: unknown[]) {
      self.selected.push(args)
    },
  }))

const Track = types
  .model('StubTrack', {
    id: types.identifier,
    type: types.string,
    configuration: TrackConfig,
    displays: types.array(types.union(AlignmentsDisplay, VariantDisplay)),
  })
  .views(() => ({
    get rpcSessionId() {
      return 'rpc'
    },
  }))

interface Region {
  refName: string
  start: number
  end: number
  assemblyName: string
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(r => {
    resolve = r
  })
  return { promise, resolve }
}

const StubView = types
  .model('StubView', {
    id: types.identifier,
    type: types.literal('LinearGenomeView'),
    tracks: types.array(Track),
    displayedRegions: types.frozen<Region[]>(),
  })
  .volatile(() => ({
    width: 800,
    location: undefined as Region | undefined,
    pending: [] as {
      location: Region
      resolve: () => void
      promise: Promise<void>
    }[],
  }))
  .views(() => ({
    get assemblyNames() {
      return ['volvox']
    },
    get initialized() {
      return true
    },
  }))
  .actions(self => ({
    setWidth(w: number) {
      self.width = w
    },
    setDisplayedRegions(regions: Region[]) {
      self.displayedRegions = regions
    },
    setLocation(location: Region) {
      self.location = location
    },
    navTo(location: Region) {
      if (
        !self.displayedRegions.some(
          r =>
            r.refName === location.refName &&
            r.start <= location.start &&
            r.end >= location.end,
        )
      ) {
        throw new Error('not in a displayed region')
      }
      self.location = location
    },
    navToLocations(regions: Region[]) {
      const location = regions[0]!
      const d = deferred()
      self.pending.push({ location, resolve: d.resolve, promise: d.promise })
      return d.promise
    },
  }))

const ReviewView = withVariantReview(StubView)

const notifications: string[] = []
const rpcCall = jest.fn()

const StubSession = types
  .model('StubSession', {
    view: ReviewView,
    configuration: ConfigurationSchema('StubRoot', {
      VariantReviewPlugin: configSchema,
    }),
  })
  .volatile(() => ({
    focusedViewId: 'lgv',
    rpcManager: { call: rpcCall },
    assemblies: [],
    assemblyManager: {
      getCanonicalAssemblyName: (n: string) => n,
      waitForAssembly: async () => ({
        name: 'volvox',
        regions: [
          { refName: 'ctgA', start: 0, end: 50_000 },
          { refName: 'ctgB', start: 0, end: 6000 },
          { refName: 'ctgC', start: 0, end: 6000 },
        ],
      }),
    },
  }))
  .actions(() => ({
    notify(message: string) {
      notifications.push(message)
    },
  }))

function candidate(
  refName: string,
  start: number,
  // null: no sort column (undefined would take the default)
  sort: CandidateVariant['sort'] | null = { type: 'basePair', pos: start },
): CandidateVariant {
  return {
    id: `volvox:${refName}:${start + 1}:G:A`,
    assemblyName: 'volvox',
    refName,
    start,
    end: start + 1,
    pos1: start + 1,
    ref: 'G',
    alt: ['A'],
    info: {},
    kind: 'snv',
    sort: sort ?? undefined,
    sourceFeatureId: `f-${refName}-${start}`,
  }
}

function makeSession(opts?: {
  config?: Record<string, unknown>
  throwingDisplay?: boolean
  priorSort?: { type: string; pos: number; refName: string }
  decisions?: Record<string, { decision: string }>
}) {
  notifications.length = 0
  rpcCall.mockReset()
  const session = StubSession.create({
    configuration: { VariantReviewPlugin: opts?.config ?? {} },
    view: {
      id: 'lgv',
      type: 'LinearGenomeView',
      reviewDecisions: opts?.decisions ?? {},
      displayedRegions: [
        { refName: 'ctgA', start: 0, end: 50_000, assemblyName: 'volvox' },
      ],
      tracks: [
        {
          id: 'vt',
          type: 'VariantTrack',
          configuration: { trackId: 'variants', name: 'Calls' },
          displays: [{ id: 'vd', type: 'LinearVariantDisplay' }],
        },
        {
          id: 't1',
          type: 'AlignmentsTrack',
          configuration: { trackId: 'tumour' },
          displays: [
            {
              id: 'tumour-d',
              type: 'LinearAlignmentsDisplay',
              sortedBy: opts?.priorSort,
            },
          ],
        },
        {
          id: 't2',
          type: 'AlignmentsTrack',
          configuration: { trackId: 'normal' },
          displays: [
            {
              id: 'normal-d',
              type: 'LinearAlignmentsDisplay',
              layoutOrder: 'length',
              throws: !!opts?.throwingDisplay,
            },
          ],
        },
      ],
    },
  })
  const view = session.view as unknown as VariantReviewView &
    Instance<typeof StubView>
  return { session, view }
}

function displays(view: Instance<typeof StubView>) {
  return view.tracks
    .flatMap(t => t.displays)
    .filter(d => d.type === 'LinearAlignmentsDisplay') as Instance<
    typeof AlignmentsDisplay
  >[]
}

function loaded(view: VariantReviewView, candidates: CandidateVariant[]) {
  ;(
    view as unknown as { setCandidates(c: CandidateVariant[]): void }
  ).setCandidates(candidates)
}

function startWith(
  candidates: CandidateVariant[],
  opts?: Parameters<typeof makeSession>[0],
) {
  const made = makeSession(opts)
  rpcCall.mockResolvedValue({ candidates, truncated: false, duplicates: 0 })
  return made
}

test('gotoCandidate writes the same sortedBy to every target', async () => {
  const c = candidate('ctgA', 1000, { type: 'insertion', pos: 1001 })
  const { view } = startWith([c])
  await view.startReview('variants')
  for (const d of displays(view)) {
    expect(d.sortedBy).toEqual({
      type: 'insertion',
      pos: 1001,
      refName: 'ctgA',
    })
  }
  expect(view.lastSortReport).toEqual({ sorted: 2, total: 2 })
  // and the viewport is centred within a base of the column
  const loc = view.location!
  expect(Math.abs((loc.start + loc.end) / 2 - 1001)).toBeLessThanOrEqual(1)
})

test('a throwing target is counted and does not stop the others', async () => {
  const { view } = startWith([candidate('ctgA', 1000)], {
    throwingDisplay: true,
  })
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  await view.startReview('variants')
  spy.mockRestore()
  expect(displays(view)[0]!.sortedBy?.pos).toBe(1000)
  expect(view.lastSortReport).toEqual({ sorted: 1, total: 2 })
  expect(view.location?.refName).toBe('ctgA')
})

test('a candidate with no sort column sorts nothing and says why', async () => {
  const { view } = startWith([candidate('ctgA', 1000, null)])
  await view.startReview('variants')
  expect(displays(view)[0]!.sortedBy).toBeUndefined()
  expect(view.lastSortReport?.reason).toMatch(/no sort/)
})

test('candidates are put in assembly order and the review starts at the first unreviewed', async () => {
  const cs = [
    candidate('ctgB', 5),
    candidate('ctgA', 900),
    candidate('ctgA', 7),
  ]
  // a decision from an earlier review of this list, in the session
  const { view } = startWith(cs, {
    decisions: { [cs[2]!.id]: { decision: 'accepted' } },
  })
  await view.startReview('variants')
  expect(view.candidates.map(c => c.id)).toEqual([
    cs[2]!.id,
    cs[1]!.id,
    cs[0]!.id,
  ])
  expect(view.currentCandidate?.id).toBe(cs[1]!.id)
  expect(rpcCall.mock.calls[0]![2]).toMatchObject({
    canonicalRefNames: ['ctgA', 'ctgB', 'ctgC'],
    assemblyName: 'volvox',
    infoFields: ['AF', 'DP'],
  })
})

test('restarting a review returns to the cursor', async () => {
  const cs = [candidate('ctgA', 10), candidate('ctgA', 20)]
  const { view } = startWith(cs)
  await view.startReview('variants')
  view.nextCandidate()
  view.setDecision('accepted')
  view.stopReview()
  await view.startReview('variants')
  expect(view.currentCandidate?.id).toBe(cs[1]!.id)
})

test('navigation clamps at the ends and notifies rather than wrapping', async () => {
  const { view } = startWith([candidate('ctgA', 10), candidate('ctgA', 20)])
  await view.startReview('variants')
  view.previousCandidate()
  expect(view.candidateIndex).toBe(0)
  expect(notifications).toContain('First candidate')
  view.nextCandidate()
  view.nextCandidate()
  expect(view.candidateIndex).toBe(1)
  expect(notifications).toContain('Last candidate')
})

test('nextUnreviewed wraps once', async () => {
  const cs = [
    candidate('ctgA', 10),
    candidate('ctgA', 20),
    candidate('ctgA', 30),
  ]
  const { view } = startWith(cs)
  await view.startReview('variants')
  view.gotoCandidate(2)
  view.setDecision('flagged')
  view.nextUnreviewed()
  expect(view.candidateIndex).toBe(0)
})

test('a stale async navigation is dropped, and re-done if it clobbered the current one', async () => {
  const cs = [candidate('ctgB', 100), candidate('ctgC', 200)]
  const { view } = startWith(cs)
  await view.startReview('variants')
  // both are off the displayed region, so both navigate asynchronously
  view.gotoCandidate(1)
  const [first, second] = view.pending
  expect(first!.location.refName).toBe('ctgB')
  expect(second!.location.refName).toBe('ctgC')

  // the newer one lands first
  view.setDisplayedRegions([{ ...second!.location, start: 0, end: 6000 }])
  view.setLocation(second!.location)
  second!.resolve()
  await second!.promise
  await Promise.resolve()
  expect(view.location?.refName).toBe('ctgC')

  // then the stale one: it moved the view, so review goes back
  view.setDisplayedRegions([{ ...first!.location, start: 0, end: 6000 }])
  view.setLocation(first!.location)
  first!.resolve()
  await first!.promise
  await Promise.resolve()
  const third = view.pending[2]
  expect(third?.location.refName).toBe('ctgC')
  expect(view.currentCandidate?.refName).toBe('ctgC')
})

test('a stale async navigation landing first is simply dropped', async () => {
  const cs = [candidate('ctgB', 100), candidate('ctgC', 200)]
  const { view } = startWith(cs)
  await view.startReview('variants')
  view.gotoCandidate(1)
  const [first, second] = view.pending
  first!.resolve()
  await first!.promise
  await Promise.resolve()
  second!.resolve()
  await second!.promise
  await Promise.resolve()
  expect(view.pending).toHaveLength(2)
})

test('stopReview restores each prior sort and keeps decisions', async () => {
  const priorSort = { type: 'basePair', pos: 5, refName: 'ctgA' }
  const c = candidate('ctgA', 1000)
  const { view } = startWith([c], { priorSort })
  await view.startReview('variants')
  view.setDecision('rejected')
  view.stopReview()
  const [tumour, normal] = displays(view)
  expect(tumour!.sortedBy).toEqual(priorSort)
  expect(normal!.sortedBy).toBeUndefined()
  expect(normal!.layoutOrder).toBe('length')
  expect(view.reviewActive).toBe(false)
  expect(view.reviewDecisions.get(c.id)?.decision).toBe('rejected')
  expect(view.reviewPriorDisplayState.size).toBe(0)
})

test('restoreSortOnExit off leaves the review sort in place', async () => {
  const { view } = startWith([candidate('ctgA', 1000)], {
    config: { restoreSortOnExit: false },
  })
  await view.startReview('variants')
  view.stopReview()
  expect(displays(view)[1]!.sortedBy?.pos).toBe(1000)
})

test('advanceOnDecide decides and moves in a single action', async () => {
  const cs = [candidate('ctgA', 10), candidate('ctgA', 20)]
  const { session, view } = startWith(cs, {
    config: { advanceOnDecide: true },
  })
  await view.startReview('variants')
  let snapshots = 0
  const dispose = onSnapshot(session, () => {
    snapshots++
  })
  view.setDecision('accepted')
  dispose()
  expect(snapshots).toBe(1)
  expect(view.reviewDecisions.get(cs[0]!.id)?.decision).toBe('accepted')
  expect(view.candidateIndex).toBe(1)
})

test('decisions and the cursor are in the snapshot; the list is not', async () => {
  const c = candidate('ctgA', 10)
  const { session, view } = startWith([c])
  await view.startReview('variants')
  view.setDecision('flagged')
  const snap = JSON.parse(JSON.stringify(session.view)) as Record<
    string,
    unknown
  >
  expect(snap.reviewCursorId).toBe(c.id)
  expect(snap.reviewDecisions).toEqual({ [c.id]: { decision: 'flagged' } })
  expect(snap.reviewSchemaVersion).toBe(1)
  expect(snap).not.toHaveProperty('candidates')
})

test('a refresh that drops the cursor moves to the next record after it', async () => {
  const cs = [
    candidate('ctgA', 10),
    candidate('ctgA', 20),
    candidate('ctgB', 5),
  ]
  const { view } = startWith(cs)
  await view.startReview('variants')
  view.gotoCandidate(1)
  rpcCall.mockResolvedValue({
    candidates: [cs[0], cs[2]],
    truncated: false,
    duplicates: 0,
  })
  await view.refreshCandidates()
  expect(view.currentCandidate?.id).toBe(cs[2]!.id)
  expect(notifications).toContain('Candidate no longer in list — moved to next')
})

test('details open through the variant display, on the displayed region', async () => {
  const c = candidate('ctgA', 10)
  const { view } = startWith([c])
  await view.startReview('variants')
  view.showCandidateDetails()
  const vd = view.tracks[0]!.displays[0] as unknown as { selected: unknown[][] }
  expect(vd.selected).toEqual([[c.sourceFeatureId, undefined, 0]])
})

test('a track that is not a variant track in this view refuses to start', async () => {
  const { view } = startWith([])
  await view.startReview('tumour')
  expect(view.reviewActive).toBe(false)
  expect(notifications.join('; ')).toMatch(/not a variant track/)
})

test('setCandidates outside review is harmless', () => {
  const { view } = makeSession()
  loaded(view, [candidate('ctgA', 1)])
  expect(view.currentCandidate).toBeUndefined()
  expect(view.candidateIndex).toBe(-1)
})

// A session saved mid-review opens in a build without this plugin: the review
// props are unknown keys there, which MST ignores (and a re-save drops).
test('a plugin-less view accepts a reviewing snapshot', () => {
  const { session } = startWith([candidate('ctgA', 10)])
  const snap = JSON.parse(JSON.stringify(session.view)) as object
  const plain = StubView.create({
    ...snap,
    reviewTrackId: 'variants',
    reviewDecisions: { x: { decision: 'accepted' } },
  } as never)
  expect(plain.id).toBe('lgv')
})

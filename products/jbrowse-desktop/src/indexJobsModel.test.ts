import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { destroy, types } from '@jbrowse/mobx-state-tree'
import { when } from 'mobx'

import jobsModelFactory from './indexJobsModel.ts'

import type { TextJobsEntry } from './indexJobsModel.ts'
import type { JobInput, JobState, JobsListModel } from '@jbrowse/app-core'
import type { Track } from '@jbrowse/text-indexing-core'

interface RpcArgs {
  signal: AbortSignal
}

// invokeIpc reaches the main process for the userData directory; the RPC that
// would write under it is stubbed too, so a run touches no disk.
jest.mock('./ipc.ts', () => ({
  invokeIpc: jest.fn().mockResolvedValue('/userData'),
}))

const JobsManager = jobsModelFactory()

// Every method of the widget this model drives. Naming them against the
// published JobsListModel is what keeps the fake below honest: rename one,
// drop one, or change what it takes, and this stops compiling rather than
// passing against a fake that no longer resembles the widget. Only the returns
// are loosened to void — the model discards all of them (the widget hands back
// the Job it filed), so pinning them here would buy nothing and force the fake
// to build MST nodes.
type JobsListApi = {
  [K in keyof Pick<JobsListModel, 'addJob' | 'updateJobStatus'>]: (
    ...args: Parameters<JobsListModel[K]>
  ) => void
}

// Records the cards a user would see, keyed by name the way the real widget
// files them, without pulling its MST model into a desktop unit test.
function makeJobsListFake() {
  const jobs: JobInput[] = []
  const api: JobsListApi = {
    addJob: ({ name, ...fields }) => {
      const job = jobs.find(j => j.name === name)
      if (job) {
        Object.assign(job, fields)
      } else {
        jobs.push({ name, ...fields })
      }
    },
    updateJobStatus: (name, statusMessage, progressPct) => {
      const job = jobs.find(j => j.name === name)
      if (job) {
        Object.assign(job, { statusMessage, progressPct })
      }
    },
  }
  const inState = (state: JobState) => jobs.filter(j => j.state === state)
  const card = (name: string) => jobs.find(j => j.name === name)!
  return { ...api, jobs, inState, card }
}

// the error paths console.error on purpose; the spies that silence them are
// per-test, so they must not leak into the tests that follow
afterEach(() => {
  jest.restoreAllMocks()
})

function makeTrack(trackId: string, adapterType: string): Track {
  return {
    trackId,
    name: trackId,
    assemblyNames: ['volvox'],
    adapter: { type: adapterType },
  }
}

function makeEntry(overrides: Partial<TextJobsEntry> = {}): TextJobsEntry {
  return {
    trackId: 't1',
    attributes: ['Name', 'ID'],
    exclude: ['CDS', 'exon'],
    assemblies: ['volvox'],
    ...overrides,
  }
}

function setup({
  tracks = [makeTrack('t1', 'Gff3TabixAdapter')],
  call = jest.fn().mockResolvedValue(undefined),
}: {
  tracks?: Track[]
  call?: jest.Mock
} = {}) {
  // getOrCreateJobsListWidget finds this rather than calling addWidget, which
  // is the seam the model reaches the widget through
  const widget = makeJobsListFake()
  const session = {
    rpcManager: {},
    configuration: {},
    widgets: new Map([['JobsList', widget]]),
    showWidget: jest.fn(),
    addWidget: jest.fn(),
    notify: jest.fn(),
    notifyError: jest.fn(),
    get trackBasesById() {
      return new Map(tracks.map(t => [t.trackId, t]))
    },
  }

  // replace-by-index, not a mutation of the found entry, so this fake
  // exercises the identity change the hydration cache (ADR-031) needs to see
  const updateTrackBase = (trackConf: { trackId: string }) => {
    const idx = tracks.findLastIndex(t => t.trackId === trackConf.trackId)
    if (idx !== -1) {
      tracks[idx] = trackConf
    }
  }

  const Root = types
    .model('FakeDesktopRoot', { jobsManager: types.optional(JobsManager, {}) })
    .volatile(() => ({
      jbrowse: {
        rpcManager: { call },
      },
      session,
      updateTrackBase,
    }))

  const root = Root.create({})
  const { jobsManager } = root
  return {
    root,
    jobsManager,
    widget,
    session,
    call,
    drained: () => when(() => jobsManager.jobsQueue.length === 0),
  }
}

// lets a run reach the RPC call it parks on
function flush() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

// an RPC that runs until the test lets it finish
function heldCall() {
  const finishers: (() => void)[] = []
  const call = jest.fn(
    () =>
      new Promise<void>(resolve => {
        finishers.push(resolve)
      }),
  )
  return {
    call,
    finish: () => {
      finishers.shift()?.()
    },
  }
}

test('reportStatus turns the worker’s byte counts into a human status', () => {
  const { jobsManager, widget } = setup()
  widget.addJob({ name: 't1', state: 'running' })
  const card = widget.card('t1')

  jobsManager.reportStatus('t1', {
    message: 'Indexing files',
    current: 5000,
    total: 20000,
  })
  expect(card.statusMessage).toBe('Indexing files: 5.0 kB / 20.0 kB')
  expect(card.progressPct).toBe(25)

  // no total yet: report what has been read rather than a bogus denominator,
  // and leave the bar indeterminate
  jobsManager.reportStatus('t1', {
    message: 'Indexing files',
    current: 5000,
    total: 0,
  })
  expect(card.statusMessage).toBe('Indexing files: 5.0 kB')
  expect(card.progressPct).toBeUndefined()

  // a plain string is already the message, and carries no fraction
  jobsManager.reportStatus('t1', {
    message: 'Indexing files',
    current: 20000,
    total: 20000,
  })
  expect(card.progressPct).toBe(100)
  jobsManager.reportStatus('t1', 'Sorting and writing index')
  expect(card.statusMessage).toBe('Sorting and writing index')
  expect(card.progressPct).toBeUndefined()
})

test('re-indexing keeps the track’s own indexing policy', async () => {
  const track = {
    ...makeTrack('t1', 'Gff3TabixAdapter'),
    textSearching: { indexingFeatureTypesToInclude: ['gene', 'mRNA'] },
  }
  const tracks = [track]
  const { jobsManager, drained } = setup({ tracks })
  jobsManager.queueJob(makeEntry())
  await drained()

  expect(tracks[0]!.textSearching).toMatchObject({
    indexingFeatureTypesToInclude: ['gene', 'mRNA'],
    textSearchAdapter: {
      ixFilePath: { localPath: expect.stringMatching(/t1-index\.ix$/) },
    },
  })
})

test('jobs run one at a time, in the order they were queued', async () => {
  const { call, finish } = heldCall()
  const { jobsManager, widget, drained } = setup({
    tracks: [
      makeTrack('t1', 'Gff3TabixAdapter'),
      makeTrack('t2', 'Gff3TabixAdapter'),
    ],
    call,
  })
  jobsManager.queueJob(makeEntry({ label: 'Volvox genes' }))
  jobsManager.queueJob(makeEntry({ trackId: 't2' }))

  expect(widget.card('t1')).toMatchObject({
    state: 'running',
    label: 'Volvox genes',
  })
  expect(widget.card('t2').state).toBe('queued')

  await flush()
  finish()
  await flush()
  expect(widget.card('t1').state).toBe('finished')
  expect(widget.card('t2').state).toBe('running')

  finish()
  await drained()
  expect(widget.inState('finished').map(j => j.name)).toEqual(['t1', 't2'])
})

// the drawer is opened by the click that queued the job, and not again when it
// starts or finishes: a queue of several tracks otherwise took the drawer back
// from whatever the user had opened since, once per transition
test('only queueing opens the Jobs list', async () => {
  const { jobsManager, widget, session, drained } = setup()
  jobsManager.queueJob(makeEntry())
  await drained()

  expect(session.showWidget).toHaveBeenCalledTimes(1)
  expect(session.showWidget).toHaveBeenCalledWith(widget)
})

test('queueing a track that is already running files it once and leaves it running', async () => {
  const { call, finish } = heldCall()
  const { jobsManager, widget, drained } = setup({ call })
  jobsManager.queueJob(makeEntry({ label: 'Volvox genes' }))
  jobsManager.queueJob(makeEntry({ label: 'Volvox genes' }))

  expect(jobsManager.jobsQueue).toHaveLength(1)
  expect(widget.jobs).toEqual([
    expect.objectContaining({ state: 'running', label: 'Volvox genes' }),
  ])

  await flush()
  finish()
  await drained()
  expect(call).toHaveBeenCalledTimes(1)
})

test('a successful run writes the index and says so', async () => {
  const tracks = [makeTrack('t1', 'Gff3TabixAdapter')]
  const originalT1 = tracks[0]
  const { jobsManager, widget, session, drained } = setup({ tracks })
  jobsManager.queueJob(makeEntry({ label: 'Volvox genes' }))
  await drained()

  // one card throughout: queued -> running -> finished, never two of them
  expect(widget.jobs).toEqual([
    expect.objectContaining({ state: 'finished', statusMessage: 'Done' }),
  ])
  expect(session.notify).toHaveBeenCalledWith(
    'Indexed track Volvox genes',
    'success',
  )
  expect(tracks[0]!.textSearching).toBeDefined()
  // replaced, not mutated (ADR-031's hydration cache keys on object identity)
  expect(tracks[0]).not.toBe(originalT1)
  expect(jobsManager.controller).toBeUndefined()
})

// an unsupported adapter is filtered out before the RPC, and must not get a
// success notice or a textSearchAdapter pointing at an .ix that was never
// written
test('a track whose adapter cannot be indexed gets no index and no notice', async () => {
  const tracks = [makeTrack('t1', 'BamAdapter')]
  const { jobsManager, session, call, drained } = setup({ tracks })
  jobsManager.queueJob(makeEntry())
  await drained()

  expect(call.mock.calls[0]![2].tracks).toEqual([])
  expect(session.notify).not.toHaveBeenCalled()
  expect(tracks[0]!.textSearching).toBeUndefined()
})

// The run takes minutes, and the track it was indexing can be deleted inside
// them: there is then nothing to write the textSearchAdapter onto, so saying it
// was indexed named a track that is gone and an .ix nothing points at.
test('a track deleted while the run was going gets no success notice', async () => {
  const tracks = [makeTrack('t1', 'Gff3TabixAdapter')]
  const { jobsManager, session, drained } = setup({
    tracks,
    call: jest.fn().mockImplementation(() => {
      tracks.length = 0
      return Promise.resolve(undefined)
    }),
  })
  jobsManager.queueJob(makeEntry())
  await drained()

  expect(session.notify).not.toHaveBeenCalled()
  expect(session.notifyError).not.toHaveBeenCalled()
})

test('a job naming a since-deleted track is dequeued, not left stuck', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const { jobsManager, widget, session, call, drained } = setup({ tracks: [] })
  jobsManager.queueJob(makeEntry())
  await drained()

  // findTrackConfigsToIndex throws before the RPC, inside the try, so the job
  // is reported and dequeued rather than holding the head of the queue
  expect(call).not.toHaveBeenCalled()
  expect(widget.inState('aborted').map(j => j.name)).toEqual(['t1'])
  expect(session.notifyError).toHaveBeenCalled()
})

// "Return to start screen", a session swap and quitting all destroy the root a
// task after detaching it, and detach kills the RPC workers — so a job still
// running lands in its own catch against a tree that is gone. Every line there
// reaches for the session, and the getParent hop behind it throws rather than
// warning, which reached the renderer as an unhandled rejection.
test.each([
  [
    'resolves',
    (resolve: () => void) => {
      resolve()
    },
  ],
  [
    'rejects',
    (_resolve: () => void, reject: (e: unknown) => void) => {
      reject(new Error('worker terminated'))
    },
  ],
])(
  'a run whose tree is destroyed mid-RPC stops rather than throwing (%s)',
  async (_name, release) => {
    let settle: (() => void) | undefined
    const { jobsManager, root, session } = setup({
      call: jest.fn().mockImplementation(
        () =>
          new Promise<void>((resolve, reject) => {
            settle = () => {
              release(resolve, reject)
            }
          }),
      ),
    })
    const running = jobsManager.runIndexingJob(makeEntry())
    // let runIndexingJob reach the RPC call it is now parked on
    await flush()

    destroy(root)
    settle!()

    await expect(running).resolves.toBeUndefined()
    expect(session.notify).not.toHaveBeenCalled()
    expect(session.notifyError).not.toHaveBeenCalled()
  },
)

test('the error notification offers a Retry that runs the job again', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const tracks: Track[] = []
  const { jobsManager, widget, session, call, drained } = setup({ tracks })
  jobsManager.queueJob(makeEntry({ label: 'Volvox genes' }))
  await drained()
  expect(widget.card('t1').state).toBe('aborted')

  const action = session.notifyError.mock.calls[0]![3]
  expect(action.name).toBe('Retry')

  tracks.push(makeTrack('t1', 'Gff3TabixAdapter'))
  action.onClick()
  await drained()

  expect(call).toHaveBeenCalledTimes(1)
  expect(widget.card('t1')).toMatchObject({
    state: 'finished',
    label: 'Volvox genes',
  })
})

test('Cancel on a running job aborts its RPC and reports a cancellation', async () => {
  // the real RPC method checks the signal before it does anything, so the fake
  // has to as well or a cancel looks like a success here and nowhere else
  let cancelCard = () => {}
  const call = jest.fn((_sessionId: string, _method: string, args: RpcArgs) => {
    cancelCard()
    checkAbortSignal(args.signal)
    return Promise.resolve()
  })
  const { jobsManager, widget, session, drained } = setup({ call })
  cancelCard = () => {
    widget.card('t1').cancelCallback!()
  }

  jobsManager.queueJob(makeEntry())
  await drained()

  expect(session.notify).toHaveBeenCalledWith('Cancelled indexing t1', 'info')
  expect(session.notifyError).not.toHaveBeenCalled()
  expect(widget.card('t1')).toMatchObject({
    state: 'aborted',
    statusMessage: 'Cancelled',
  })
  expect(jobsManager.controller).toBeUndefined()
})

test('Cancel on a queued job drops it and leaves the running one alone', async () => {
  const { call, finish } = heldCall()
  const { jobsManager, widget, drained } = setup({
    tracks: [
      makeTrack('t1', 'Gff3TabixAdapter'),
      makeTrack('t2', 'Gff3TabixAdapter'),
    ],
    call,
  })
  jobsManager.queueJob(makeEntry())
  jobsManager.queueJob(makeEntry({ trackId: 't2' }))
  await flush()

  widget.card('t2').cancelCallback!()

  expect(jobsManager.jobsQueue.map(j => j.trackId)).toEqual(['t1'])
  expect(widget.card('t2')).toMatchObject({
    state: 'aborted',
    statusMessage: 'Cancelled',
  })
  expect(widget.card('t1').state).toBe('running')
  expect(jobsManager.controller?.signal.aborted).toBe(false)

  finish()
  await drained()
  expect(call).toHaveBeenCalledTimes(1)
  expect(widget.card('t1').state).toBe('finished')
})

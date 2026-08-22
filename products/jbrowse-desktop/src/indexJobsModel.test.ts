import { checkStopToken, isStopped } from '@jbrowse/core/util/stopToken'
import { types } from '@jbrowse/mobx-state-tree'

import jobsModelFactory from './indexJobsModel.ts'

import type { TextJobsEntry } from './indexJobsModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type {
  JobInput,
  JobState,
  JobsListModel,
} from '@jbrowse/plugin-jobs-management'
import type { Track } from '@jbrowse/text-indexing-core'

interface RpcArgs {
  stopToken: StopToken
}

// invokeIpc reaches the main process for the userData directory, and the model
// then mkdirs the trix output under it. Both are stubbed so a run touches no
// disk: what these tests are about is the queue's bookkeeping, not the indexer.
jest.mock('./ipc.ts', () => ({
  invokeIpc: jest.fn().mockResolvedValue('/userData'),
}))
jest.mock('node:fs', () => ({ mkdirSync: jest.fn() }))

const pluginManager = {} as PluginManager
const JobsManager = jobsModelFactory(pluginManager)

// Every method of the widget this model drives. Naming them against the
// plugin's published JobsListModel is what keeps the fake below honest: rename
// one, drop one, or change what it takes, and this stops compiling rather than
// passing against a fake that no longer resembles the widget. Only the returns
// are loosened to void — the model discards all of them (the widget hands back
// the Job it filed), so pinning them here would buy nothing and force the fake
// to build MST nodes.
type JobsListApi = {
  [K in keyof Pick<JobsListModel, 'addJob' | 'updateJobStatus'>]: (
    ...args: Parameters<JobsListModel[K]>
  ) => void
}

type JobCard = JobInput

// Records the cards a user would see, keyed by name the way the real widget
// files them, without pulling its MST model into a desktop unit test.
function makeJobsListFake() {
  const jobs: JobCard[] = []
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
  return { ...api, jobs, inState }
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
    name: 'job1',
    indexingParams: {
      attributes: ['Name', 'ID'],
      exclude: ['CDS', 'exon'],
      assemblies: ['volvox'],
      tracks: ['t1'],
      indexType: 'perTrack',
    },
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
  }
  const textSearchManager = { clearCache: jest.fn() }
  const aggregateTextSearchAdapters: { textSearchAdapterId: string }[] = []

  const Root = types
    .model('FakeDesktopRoot', { jobsManager: types.optional(JobsManager, {}) })
    .volatile(() => ({
      jbrowse: { rpcManager: { call }, tracks, aggregateTextSearchAdapters },
      session,
      textSearchManager,
    }))

  const root = Root.create({})
  return {
    root,
    jobsManager: root.jobsManager,
    widget,
    session,
    textSearchManager,
    aggregateTextSearchAdapters,
    call,
  }
}

test('reportStatus turns the worker’s byte counts into a human status', () => {
  const { jobsManager, widget } = setup()
  widget.addJob({ name: 'job1', state: 'running' })
  const card = widget.jobs[0]!

  jobsManager.reportStatus('job1', {
    message: 'Indexing files',
    current: 5000,
    total: 20000,
  })
  expect(card.statusMessage).toBe('Indexing files: 5.0 kB / 20.0 kB')
  expect(card.progressPct).toBe(25)

  // no total yet: report what has been read rather than a bogus denominator,
  // and leave the bar indeterminate
  jobsManager.reportStatus('job1', {
    message: 'Indexing files',
    current: 5000,
    total: 0,
  })
  expect(card.statusMessage).toBe('Indexing files: 5.0 kB')
  expect(card.progressPct).toBeUndefined()

  // a plain string is already the message, and carries no fraction
  jobsManager.reportStatus('job1', {
    message: 'Indexing files',
    current: 20000,
    total: 20000,
  })
  expect(card.progressPct).toBe(100)
  jobsManager.reportStatus('job1', 'Sorting and writing index')
  expect(card.statusMessage).toBe('Sorting and writing index')
  expect(card.progressPct).toBeUndefined()
})

test('queueJob shows the widget and files the job as queued', () => {
  const { jobsManager, widget, session } = setup()
  jobsManager.queueJob(makeEntry())

  expect(session.showWidget).toHaveBeenCalledWith(widget)
  expect(widget.inState('queued').map(j => j.name)).toEqual(['job1'])
  expect(jobsManager.jobsQueue).toHaveLength(1)
})

test('a successful perTrack run indexes only the supported adapters', async () => {
  const tracks = [
    makeTrack('t1', 'Gff3TabixAdapter'),
    makeTrack('t2', 'BamAdapter'),
  ]
  const { jobsManager, widget, session, textSearchManager, call } = setup({
    tracks,
  })
  jobsManager.queueJob(
    makeEntry({
      indexingParams: {
        ...makeEntry().indexingParams,
        tracks: ['t1', 't2'],
      },
    }),
  )
  await jobsManager.runJob()

  // one card throughout: queued -> running -> finished, never two of them
  expect(widget.jobs).toHaveLength(1)
  expect(widget.inState('queued')).toHaveLength(0)

  // t2's adapter can't be indexed, so it is filtered out before the RPC — and
  // must not get a success notice or a textSearchAdapter pointing at an .ix
  // that was never written
  expect(call.mock.calls[0]![2].tracks.map((t: Track) => t.trackId)).toEqual([
    't1',
  ])
  expect(session.notify).toHaveBeenCalledTimes(1)
  expect(session.notify).toHaveBeenCalledWith(
    expect.stringContaining('t1'),
    'success',
  )
  expect(tracks[0]!.textSearching).toBeDefined()
  expect(tracks[1]!.textSearching).toBeUndefined()

  expect(textSearchManager.clearCache).toHaveBeenCalled()
  expect(widget.inState('finished').map(j => j.name)).toEqual(['job1'])
  expect(jobsManager.running).toBe(false)
})

test('an aggregate run writes one adapter per assembly, replacing any existing', async () => {
  const { jobsManager, aggregateTextSearchAdapters } = setup()
  aggregateTextSearchAdapters.push({ textSearchAdapterId: 'volvox-index' })

  jobsManager.queueJob(
    makeEntry({
      indexingParams: {
        ...makeEntry().indexingParams,
        indexType: 'aggregate',
      },
    }),
  )
  await jobsManager.runJob()

  expect(aggregateTextSearchAdapters).toHaveLength(1)
  expect(aggregateTextSearchAdapters[0]).toHaveProperty(
    'textSearchAdapterId',
    'volvox-index',
  )
  expect(aggregateTextSearchAdapters[0]).toHaveProperty('ixFilePath')
})

test('a job naming a since-deleted track is dequeued, not left stuck', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const { jobsManager, widget, session, call } = setup({ tracks: [] })
  jobsManager.queueJob(makeEntry())

  await jobsManager.runJob()

  // findTrackConfigsToIndex throws before the RPC. The point of resolving the
  // configs inside the try is that this dequeues rather than looping the
  // autorun forever on a queue entry that can never succeed.
  expect(call).not.toHaveBeenCalled()
  expect(jobsManager.jobsQueue).toHaveLength(0)
  expect(widget.inState('aborted').map(j => j.name)).toEqual(['job1'])
  expect(session.notifyError).toHaveBeenCalled()
})

test('the error notification offers a Retry that re-queues the job', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const { jobsManager, session } = setup({ tracks: [] })
  jobsManager.queueJob(makeEntry())
  await jobsManager.runJob()
  expect(jobsManager.jobsQueue).toHaveLength(0)

  const action = session.notifyError.mock.calls[0]![3]
  expect(action.name).toBe('Retry')

  action.onClick()
  expect(jobsManager.jobsQueue.map(j => j.name)).toEqual(['job1'])
})

test('a cancelled job reports as cancelled rather than as an error', async () => {
  // the real RPC method checks the token before it does anything, so the fake
  // has to as well or a cancel looks like a success here and nowhere else.
  // Read inside the call, not after it: clear() stops the token on every path,
  // so an assertion made afterwards passes whether the cancel landed or not
  let stoppedAtCall: boolean | undefined
  const call = jest.fn((_sessionId: string, _method: string, args: RpcArgs) => {
    stoppedAtCall = isStopped(args.stopToken)
    checkStopToken(args.stopToken)
    return Promise.resolve()
  })
  const { jobsManager, widget, session } = setup({ call })

  jobsManager.queueJob(makeEntry())
  jobsManager.abortJob()
  await jobsManager.runJob()

  expect(stoppedAtCall).toBe(true)
  expect(session.notify).toHaveBeenCalledWith(
    'Cancelled indexing job: job1',
    'info',
  )
  expect(session.notifyError).not.toHaveBeenCalled()
  expect(widget.inState('aborted')[0]!.statusMessage).toBe('Cancelled')
  // clear() resets the flag, so the next job isn't reported as cancelled too
  expect(jobsManager.aborted).toBe(false)
})

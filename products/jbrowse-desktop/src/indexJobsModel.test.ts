import { types } from '@jbrowse/mobx-state-tree'

import jobsModelFactory from './indexJobsModel.ts'

import type { TextJobsEntry } from './indexJobsModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { JobsListModel } from '@jbrowse/plugin-jobs-management'
import type { Track } from '@jbrowse/text-indexing-core'

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
  [
    K in keyof Pick<
      JobsListModel,
      | 'addJob'
      | 'addQueuedJob'
      | 'addFinishedJob'
      | 'addAbortedJob'
      | 'removeJob'
      | 'removeQueuedJob'
      | 'updateJobStatusMessage'
    >
  ]: (...args: Parameters<JobsListModel[K]>) => void
}

interface JobCard {
  name: string
  statusMessage?: string
}

// Records the cards a user would see, in the four lists the real widget files
// them into, without pulling the widget's MST model into a desktop unit test.
function makeJobsListFake() {
  const jobs: JobCard[] = []
  const queued: JobCard[] = []
  const finished: JobCard[] = []
  const aborted: JobCard[] = []
  const remove = (arr: JobCard[], name: string) => {
    const i = arr.findIndex(j => j.name === name)
    if (i !== -1) {
      arr.splice(i, 1)
    }
  }
  const api: JobsListApi = {
    addJob: job => jobs.push({ ...job }),
    addQueuedJob: job => queued.push({ ...job }),
    addFinishedJob: job => finished.push({ ...job }),
    addAbortedJob: job => aborted.push({ ...job }),
    removeJob: name => {
      remove(jobs, name)
    },
    removeQueuedJob: name => {
      remove(queued, name)
    },
    updateJobStatusMessage: (name, message) => {
      const job = jobs.find(j => j.name === name)
      if (job) {
        job.statusMessage = message
      }
    },
  }
  return { ...api, jobs, queued, finished, aborted }
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
  jobsManager.setJobName('job1')
  widget.addJob({ name: 'job1' })

  jobsManager.reportStatus('5000/20000')
  expect(jobsManager.statusMessage).toBe('Indexed 5.0 kB / 20.0 kB')
  expect(widget.jobs[0]!.statusMessage).toBe('Indexed 5.0 kB / 20.0 kB')

  // no total yet: report what has been read rather than a bogus denominator
  jobsManager.reportStatus('5000/0')
  expect(jobsManager.statusMessage).toBe('Indexed 5.0 kB')

  // anything without a slash is already a message, and passes through
  jobsManager.reportStatus('Generating ixIxx')
  expect(jobsManager.statusMessage).toBe('Generating ixIxx')
})

test('queueJob shows the widget and files the job as queued', () => {
  const { jobsManager, widget, session } = setup()
  jobsManager.queueJob(makeEntry())

  expect(session.showWidget).toHaveBeenCalledWith(widget)
  expect(widget.queued.map(j => j.name)).toEqual(['job1'])
  expect(jobsManager.jobsQueue).toHaveLength(1)
})

test('dequeueJob on an empty queue returns undefined', () => {
  const { jobsManager } = setup()
  expect(jobsManager.dequeueJob()).toBeUndefined()
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

  // runJob moves the card from queued to running before handing off
  expect(widget.queued).toHaveLength(0)

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
  expect(widget.finished.map(j => j.name)).toEqual(['job1'])
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
  expect(widget.aborted.map(j => j.name)).toEqual(['job1'])
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
  const call = jest.fn().mockRejectedValue(new Error('aborted'))
  const { jobsManager, widget, session } = setup({ call })

  jobsManager.queueJob(makeEntry())
  jobsManager.abortJob()
  await jobsManager.runJob()

  expect(session.notify).toHaveBeenCalledWith(
    'Cancelled indexing job: job1',
    'info',
  )
  expect(session.notifyError).not.toHaveBeenCalled()
  expect(widget.aborted[0]!.statusMessage).toBe('Cancelled')
  // clear() resets the flag, so the next job isn't reported as cancelled too
  expect(jobsManager.aborted).toBe(false)
})

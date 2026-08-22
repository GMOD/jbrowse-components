import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { stateModelFactory } from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const JobsList = stateModelFactory({} as PluginManager)

function setup() {
  return JobsList.create({ id: 'JobsList', type: 'JobsListWidget' })
}

test('a job list saves nothing into the session snapshot', () => {
  const model = setup()
  model.addJob({ name: 'job1', statusMessage: 'Indexing files' })
  model.addQueuedJob({ name: 'job2' })
  model.addFinishedJob({ name: 'job3' })

  expect(getSnapshot(model)).toEqual({
    id: 'JobsList',
    type: 'JobsListWidget',
  })
})

test('a restored session drops the job lists an older one saved', () => {
  const model = JobsList.create({
    id: 'JobsList',
    type: 'JobsListWidget',
    // an older build persisted these four
    jobs: [{ name: 'job1' }],
    queued: [{ name: 'job2' }],
    finished: [],
    aborted: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  expect(model.jobs).toHaveLength(0)
  expect(model.queued).toHaveLength(0)
})

test('adding a job that is already listed refreshes it rather than duplicating', () => {
  const model = setup()
  const first = model.addJob({ name: 'job1', statusMessage: 'Starting' })
  const again = model.addJob({ name: 'job1', statusMessage: 'Indexing files' })

  expect(model.jobs).toHaveLength(1)
  expect(again).toBe(first)
  expect(first.statusMessage).toBe('Indexing files')
})

test('a status with no fraction leaves the bar indeterminate', () => {
  const model = setup()
  const job = model.addJob({ name: 'job1' })

  model.updateJobStatus('job1', 'Indexing files', 40)
  expect(job.progressPct).toBe(40)

  model.updateJobStatus('job1', 'Sorting and writing index')
  expect(job.statusMessage).toBe('Sorting and writing index')
  expect(job.progressPct).toBeUndefined()
})

test('a status for a job that is gone is dropped', () => {
  const model = setup()
  model.addJob({ name: 'job1' })
  model.removeJob('job1')

  expect(() => {
    model.updateJobStatus('job1', 'Indexing files', 40)
  }).not.toThrow()
})

test('clearing a list leaves the others alone', () => {
  const model = setup()
  model.addFinishedJob({ name: 'job1' })
  model.addAbortedJob({ name: 'job2' })

  model.clearFinished()
  expect(model.finished).toHaveLength(0)
  expect(model.aborted.map(j => j.name)).toEqual(['job2'])
})

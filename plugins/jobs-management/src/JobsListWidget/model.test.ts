import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { stateModelFactory } from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const JobsList = stateModelFactory({} as PluginManager)

function setup() {
  return JobsList.create({ id: 'JobsList', type: 'JobsListWidget' })
}

test('a job list saves nothing into the session snapshot', () => {
  const model = setup()
  model.addJob({ name: 'job1', state: 'running', statusMessage: 'Indexing' })
  model.addJob({ name: 'job2', state: 'queued' })

  expect(getSnapshot(model)).toEqual({
    id: 'JobsList',
    type: 'JobsListWidget',
  })
})

test('a restored session drops the job lists an older one saved', () => {
  const model = JobsList.create({
    id: 'JobsList',
    type: 'JobsListWidget',
    // an older build persisted four separate lists
    jobs: [{ name: 'job1' }],
    queued: [{ name: 'job2' }],
    finished: [],
    aborted: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  expect(model.jobs).toHaveLength(0)
})

test('a job that changes state moves rather than being listed twice', () => {
  const model = setup()
  const queued = model.addJob({ name: 'job1', state: 'queued' })
  const running = model.addJob({ name: 'job1', state: 'running' })

  expect(model.jobs).toHaveLength(1)
  expect(running).toBe(queued)
  expect(queued.state).toBe('running')
})

test('a field left out of addJob is not disturbed', () => {
  const model = setup()
  const job = model.addJob({
    name: 'job1',
    state: 'running',
    statusMessage: 'Indexing files',
  })
  model.addJob({ name: 'job1', state: 'finished' })

  expect(job.statusMessage).toBe('Indexing files')
})

test('a status with no fraction leaves the bar indeterminate', () => {
  const model = setup()
  const job = model.addJob({ name: 'job1', state: 'running' })

  model.updateJobStatus('job1', 'Indexing files', 40)
  expect(job.progressPct).toBe(40)

  model.updateJobStatus('job1', 'Sorting and writing index')
  expect(job.statusMessage).toBe('Sorting and writing index')
  expect(job.progressPct).toBeUndefined()
})

test('a status for a job that is gone is dropped', () => {
  const model = setup()
  model.addJob({ name: 'job1', state: 'finished' })
  model.clearJobs('finished')

  expect(() => {
    model.updateJobStatus('job1', 'Indexing files', 40)
  }).not.toThrow()
})

test('clearing one state leaves the others alone', () => {
  const model = setup()
  model.addJob({ name: 'job1', state: 'finished' })
  model.addJob({ name: 'job2', state: 'aborted' })
  model.addJob({ name: 'job3', state: 'running' })

  model.clearJobs('finished')
  expect(model.jobs.map(j => j.name)).toEqual(['job2', 'job3'])
})

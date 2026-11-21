import { act, fireEvent, render } from '@testing-library/react'

import { stateModelFactory } from '../model.ts'
import JobsListWidget from './JobsListWidget.tsx'

import type { JobInput } from '../model.ts'

function setup(jobs: JobInput[] = []) {
  const model = stateModelFactory().create({
    id: 'JobsList',
    type: 'JobsListWidget',
  })
  for (const job of jobs) {
    model.addJob(job)
  }
  return { model, ...render(<JobsListWidget model={model} />) }
}

test('an empty list says so once', () => {
  const { container } = setup()

  expect(container.textContent).toBe('No jobs')
})

test('only the sections holding jobs are drawn', () => {
  const { getByRole, queryByRole } = setup([
    { name: 'volvox_gff3', state: 'running' },
  ])

  getByRole('heading', { name: 'Running jobs' })
  expect(queryByRole('heading', { name: 'Queued jobs' })).toBeNull()
  expect(queryByRole('heading', { name: 'Completed jobs' })).toBeNull()
  expect(queryByRole('heading', { name: 'Aborted jobs' })).toBeNull()
})

test('a job moves section when its state changes', () => {
  const { model, getByRole, queryByRole } = setup([
    { name: 'volvox_gff3', state: 'running' },
  ])

  act(() => {
    model.addJob({ name: 'volvox_gff3', state: 'finished' })
  })

  getByRole('heading', { name: 'Completed jobs' })
  expect(queryByRole('heading', { name: 'Running jobs' })).toBeNull()
})

test('Clear empties its own section only', () => {
  const { getByRole, queryByRole, getByText } = setup([
    { name: 'job1', state: 'finished' },
    { name: 'job2', state: 'running' },
  ])

  fireEvent.click(getByRole('button', { name: 'Clear' }))

  expect(queryByRole('heading', { name: 'Completed jobs' })).toBeNull()
  getByText('job2')
})

import { act, fireEvent, render } from '@testing-library/react'

import { Job } from '../jobModel.ts'
import JobCard from './JobCard.tsx'

import type { JobFields } from '../jobModel.ts'

function setup(fields: Partial<JobFields> = {}) {
  const job = Job.create({ name: 'volvox_gff3' })
  job.update({ state: 'running', ...fields })
  const rendered = render(<JobCard job={job} />)
  const bar = () =>
    rendered.getByTestId('job-progress').querySelector('[role="progressbar"]')!
  return { job, bar, ...rendered }
}

test('a reported fraction draws a determinate bar and a percent to match it', () => {
  const { bar, getByText } = setup({
    statusMessage: 'Indexing volvox_col',
    progressPct: 42,
  })

  expect(bar().getAttribute('aria-valuenow')).toBe('42')
  expect(bar().firstElementChild?.getAttribute('style')).toBe(
    'transform: scaleX(0.42);',
  )
  getByText('42%')
  getByText('Indexing volvox_col')
})

test('no fraction is an indeterminate bar with no percent beside it', () => {
  const { bar, queryByText } = setup({
    statusMessage: 'Sorting and writing index',
  })

  // undefined, not 0: a bar parked at 0% with "0%" beside it reads as a job
  // that has stalled rather than one whose phase reports no fraction
  expect(bar().getAttribute('aria-valuenow')).toBeNull()
  expect(queryByText(/%$/)).toBeNull()
})

test('a phase that reports no fraction clears the bar rather than holding the last one', () => {
  const { job, bar, queryByText } = setup({
    statusMessage: 'Indexing volvox_col',
    progressPct: 97,
  })
  expect(bar().getAttribute('aria-valuenow')).toBe('97')

  act(() => {
    job.update({
      statusMessage: 'Sorting and writing index',
      progressPct: undefined,
    })
  })

  expect(bar().getAttribute('aria-valuenow')).toBeNull()
  expect(queryByText(/%$/)).toBeNull()
})

test('a job with no message renders only its name', () => {
  const { container } = setup({ state: 'finished' })

  expect(container.textContent).toBe('volvox_gff3')
})

test('the card names the job by its label when it has one', () => {
  const { getByText, queryByText } = setup({ label: 'Volvox genes' })

  getByText('Volvox genes')
  expect(queryByText('volvox_gff3')).toBeNull()
})

test('a cancel stays visible through the status updates before the abort lands', () => {
  const cancelCallback = jest.fn()
  const { job, getByRole, getByText } = setup({
    statusMessage: 'Indexing volvox_col',
    cancelCallback,
  })

  fireEvent.click(getByRole('button', { name: 'Cancel' }))
  act(() => {
    job.update({ statusMessage: 'Indexing volvox_col: 5.0 kB' })
  })

  expect(cancelCallback).toHaveBeenCalledTimes(1)
  getByText('Cancelling…', { selector: 'p' })
  expect(getByRole('button', { name: 'Cancelling…' })).toHaveProperty(
    'disabled',
    true,
  )
})

test('a retried job can be cancelled again', () => {
  const { job, getByRole } = setup({ cancelCallback: jest.fn() })
  fireEvent.click(getByRole('button', { name: 'Cancel' }))

  act(() => {
    job.update({ state: 'aborted' })
    job.update({ state: 'running' })
  })

  expect(getByRole('button', { name: 'Cancel' })).toHaveProperty(
    'disabled',
    false,
  )
})

test('a queued job has no bar, and Cancel only when its producer can cancel it', () => {
  const { queryByTestId, queryByRole, job } = setup({ state: 'queued' })

  expect(queryByTestId('job-progress')).toBeNull()
  expect(queryByRole('button')).toBeNull()

  const cancelCallback = jest.fn()
  act(() => {
    job.update({ cancelCallback })
  })
  fireEvent.click(queryByRole('button', { name: 'Cancel' })!)
  expect(cancelCallback).toHaveBeenCalledTimes(1)
})

// a Cancel that called a no-op told the user the job could be stopped
test('a running job whose producer gave no cancelCallback offers no Cancel', () => {
  const { queryByRole } = setup()

  expect(queryByRole('button')).toBeNull()
})

test('a finished job offers no Cancel even with a cancelCallback', () => {
  const { queryByRole } = setup({
    state: 'finished',
    cancelCallback: jest.fn(),
  })

  expect(queryByRole('button')).toBeNull()
})

import { act, render } from '@testing-library/react'

import { Job } from '../jobModel.ts'
import CurrentJobCard from './CurrentJobCard.tsx'

import type { JobFields } from '../jobModel.ts'

// The determinate branch of this card has been repaired three times without
// anyone rendering it. `c45b43aa2d` is the most recent: the indexer had been
// reporting `{message, current, total}` since the status channel went
// determinate, `indexJobsModel` was throwing the numbers away, and so both ends
// of the fraction were dead code — `updateJobProgressPct` had no caller and the
// percent readout below could not appear. The model has tests either side of the
// card (`model.test.ts`, `indexJobsModel.test.ts`) and the bar has its own
// (`StatusProgressBar.test.tsx`), which is exactly why the join between them was
// the part that broke: it is the one hop no test covered.

function setup(fields: Partial<JobFields> = {}) {
  const job = Job.create({ name: 'volvox names' })
  job.update({ state: 'running', ...fields })
  const rendered = render(<CurrentJobCard job={job} />)
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

// The regression c45b43aa2d fixed in the model, asserted where it is visible.
// `updateJobStatus` sets message and fraction together so an unmeasured phase
// clears the bar; before that the ixIxx tail inherited whatever fraction the
// record stream had stopped at and sat there looking stuck.
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

test('a job with no message says so instead of rendering an empty line', () => {
  const { getByText } = setup({ progressPct: 12 })

  getByText('No message provided')
})

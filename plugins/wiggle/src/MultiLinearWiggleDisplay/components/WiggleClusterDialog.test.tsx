import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createTestEnvironment, makeMultiWiggleData } from '../testEnv.ts'
import WiggleClusterDialog from './WiggleClusterDialog.tsx'

// The dialog is @jbrowse/tree-sidebar's shared ClusterDialog plus this display's
// spec, so these cover both: what the shell renders, and what the wiggle spec
// says a matrix and an applied order are.
function setup() {
  const env = createTestEnvironment()
  env.mockRpcCall.mockImplementation((_sid: string, method: string) => {
    if (method === 'MultiWiggleGetScoreMatrix') {
      return Promise.resolve(
        new Map([
          ['a', [1, 2]],
          ['b', [3, 4]],
        ]),
      )
    }
    return Promise.resolve(
      method === 'MultiWiggleClusterScoreMatrix'
        ? { order: [1, 0], tree: '(b,a);' }
        : makeMultiWiggleData('a', 'b'),
    )
  })
  return env
}

async function loadSources(display: { sourcesWithoutLayout: unknown[] }) {
  await waitFor(() => {
    expect(display.sourcesWithoutLayout.length).toBe(2)
  })
}

test('the auto tab runs clustering and closes', async () => {
  const { createDisplay } = setup()
  const { display } = createDisplay()
  await loadSources(display)

  const handleClose = jest.fn()
  const { getByText } = render(
    <WiggleClusterDialog model={display} handleClose={handleClose} />,
  )
  await userEvent.click(getByText('Run clustering'))

  await waitFor(() => {
    expect(handleClose).toHaveBeenCalled()
  })
  expect(display.layout.map(s => s.name)).toEqual(['b', 'a'])
})

test('the manual tab offers no downloads until the matrix arrives', async () => {
  const { createDisplay, mockRpcCall } = setup()
  const { display } = createDisplay()
  await loadSources(display)

  // hold the matrix so the pre-arrival state is observable at all
  let deliver = (matrix: Map<string, number[]>) => {
    void matrix
  }
  mockRpcCall.mockImplementation((_sid: string, method: string) =>
    method === 'MultiWiggleGetScoreMatrix'
      ? new Promise(resolve => {
          deliver = resolve
        })
      : Promise.resolve(makeMultiWiggleData('a', 'b')),
  )

  const { getByLabelText, getByRole } = render(
    <WiggleClusterDialog model={display} handleClose={() => {}} />,
  )
  await userEvent.click(getByLabelText(/Download R script/))
  const rscript = () =>
    getByRole('button', { name: 'Download Rscript' }) as HTMLButtonElement

  // an empty cluster.R is worse than no button
  expect(rscript().disabled).toBe(true)
  deliver(
    new Map([
      ['a', [1, 2]],
      ['b', [3, 4]],
    ]),
  )
  await waitFor(() => {
    expect(rscript().disabled).toBe(false)
  })
})

// A short or duplicated hand-pasted order would silently drop or double rows, so
// applyOrder validates and the dialog stays open on the message — beside the
// paste box, not in a session snackbar somewhere else on screen while the dialog
// covering it is the thing the user has to edit.
test('a bad pasted order keeps the manual tab open and says why', async () => {
  const { createDisplay } = setup()
  const { display } = createDisplay()
  await loadSources(display)
  const before = display.layout.map(s => s.name)

  const handleClose = jest.fn()
  const { getByLabelText, getByText, findByText } = render(
    <WiggleClusterDialog model={display} handleClose={handleClose} />,
  )
  await userEvent.click(getByLabelText(/Download R script/))
  await userEvent.type(getByLabelText(/Paste result/), '1')
  await userEvent.click(getByText('Apply clustering'))

  expect(handleClose).not.toHaveBeenCalled()
  expect(display.layout.map(s => s.name)).toEqual(before)
  expect(await findByText(/expected 2 entries, got 1/)).toBeTruthy()
})

test('a complete pasted order applies and closes', async () => {
  const { createDisplay } = setup()
  const { display } = createDisplay()
  await loadSources(display)

  const handleClose = jest.fn()
  const { getByLabelText, getByText } = render(
    <WiggleClusterDialog model={display} handleClose={handleClose} />,
  )
  await userEvent.click(getByLabelText(/Download R script/))
  await userEvent.type(getByLabelText(/Paste result/), '2\n1')
  await userEvent.click(getByText('Apply clustering'))

  expect(display.layout.map(s => s.name)).toEqual(['b', 'a'])
  expect(handleClose).toHaveBeenCalled()
})

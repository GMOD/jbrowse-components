import { fireEvent, render, waitFor } from '@testing-library/react'

import copyToClipboard from '../../../util/copyToClipboard.ts'
import { SequenceFeatureDetailsF } from '../model.ts'
import SequenceFeatureMenu from './SequenceFeatureMenu.tsx'

jest.mock('../../../util/copyToClipboard.ts', () => ({
  __esModule: true,
  default: jest.fn(),
}))

const copyMock = copyToClipboard as jest.MockedFunction<typeof copyToClipboard>

beforeEach(() => {
  copyMock.mockReset()
})

// The standalone dialog (a track's right-click "Feature sequence") creates its
// settings model detached, so the menu cannot reach a session by walking up
// from it -- getSession throws there, and the rejection took the copy with it
// silently. The session it copies through is the one its opener handed the
// panel, so a detached model still reports.
function renderDetachedMenu() {
  const notified: string[] = []
  const errors: string[] = []
  const panel = document.createElement('div')
  panel.textContent = 'ACGTACGT'

  render(
    <SequenceFeatureMenu
      model={SequenceFeatureDetailsF().create()}
      session={{
        notify: (message: string) => {
          notified.push(message)
        },
        notifyError: (message: string) => {
          errors.push(message)
        },
      }}
      ref={{ current: panel }}
      mode="genomic"
      revcomp={false}
      setRevcomp={() => {}}
    />,
  )
  return { notified, errors }
}

function clickMenuItem(label: string) {
  fireEvent.click(document.body.querySelector('button')!)
  const item = [...document.body.querySelectorAll('li')].find(
    el => el.textContent === label,
  )
  fireEvent.click(item!)
}

test('copies FASTA through the session its opener supplied', async () => {
  const { notified, errors } = renderDetachedMenu()
  clickMenuItem('Copy FASTA')

  await waitFor(() => {
    expect(notified).toEqual(['Copied sequence to clipboard'])
  })
  expect(copyMock).toHaveBeenCalledWith('ACGTACGT', undefined)
  expect(errors).toEqual([])
})

test('copies HTML through the session its opener supplied', async () => {
  const { notified, errors } = renderDetachedMenu()
  clickMenuItem('Copy HTML')

  await waitFor(() => {
    expect(notified).toEqual(['Copied sequence HTML to clipboard'])
  })
  expect(copyMock).toHaveBeenCalledWith('<div>ACGTACGT</div>', {
    format: 'text/html',
  })
  expect(errors).toEqual([])
})

test('a rejected clipboard write reaches the same session', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  copyMock.mockRejectedValueOnce(new Error('the browser said no'))
  const { notified, errors } = renderDetachedMenu()
  clickMenuItem('Copy FASTA')

  await waitFor(() => {
    expect(errors).toEqual(['Error: the browser said no'])
  })
  expect(notified).toEqual([])
})

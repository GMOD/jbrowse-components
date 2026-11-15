import { createRef } from 'react'

import { fireEvent, render, waitFor } from '@testing-library/react'

import copyToClipboard from '../../../util/copyToClipboard.ts'
import SequencePanel from '../SequencePanel.tsx'
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
      fileStem="EDEN_genomic"
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

test('the panel exports its readout, not the scroll box around it', async () => {
  const model = SequenceFeatureDetailsF().create()
  const ref = createRef<HTMLPreElement>()
  const notified: string[] = []
  render(
    <>
      <SequenceFeatureMenu
        model={model}
        session={{
          notify: (message: string) => {
            notified.push(message)
          },
          notifyError: () => {},
        }}
        ref={ref}
        fileStem="r_genomic"
        mode="genomic"
        revcomp={false}
        setRevcomp={() => {}}
      />
      <SequencePanel
        ref={ref}
        model={model}
        mode="genomic"
        sequence={{ seq: 'ACGTACGT' }}
        feature={{
          uniqueId: 'r',
          name: 'r',
          refName: 'chr1',
          start: 0,
          end: 8,
          type: 'region',
        }}
      />
    </>,
  )

  clickMenuItem('Copy HTML')
  await waitFor(() => {
    expect(notified).toEqual(['Copied sequence HTML to clipboard'])
  })
  const html = copyMock.mock.calls[0]![0]
  expect(html).toMatch(/^<pre /)
  expect(html).toContain('ACGTACGT')
  expect(html).not.toContain('overflow')
  expect(html).not.toContain('max-height')

  clickMenuItem('Copy FASTA')
  await waitFor(() => {
    expect(copyMock).toHaveBeenCalledTimes(2)
  })
  expect(copyMock.mock.calls[1]![0]).toBe('>r-genomic chr1:1-8\nACGTACGT')
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

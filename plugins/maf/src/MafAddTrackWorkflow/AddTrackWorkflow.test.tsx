import { fireEvent, render } from '@testing-library/react'

import MultiMAFWidget from './AddTrackWorkflow.tsx'

import type { AddTrackWorkflowModel } from '@jbrowse/core/util'

const mockAddTrackFromWidget = jest.fn()

jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual<object>('@jbrowse/core/util'),
  getSession: () => ({}),
  addTrackFromWidget: (args: unknown) => {
    mockAddTrackFromWidget(args)
  },
}))

jest.mock('@jbrowse/mobx-state-tree', () => ({
  ...jest.requireActual<object>('@jbrowse/mobx-state-tree'),
  getRoot: () => ({}),
}))

jest.mock('@jbrowse/core/ui', () => ({
  ...jest.requireActual<object>('@jbrowse/core/ui'),
  AssemblySelector: () => null,
}))

const model = {
  assembly: 'hg38',
  setAssembly: () => {},
} as unknown as AddTrackWorkflowModel

function typeUrl(input: HTMLElement, uri: string) {
  fireEvent.change(input, { target: { value: uri } })
}

function submittedAdapter() {
  const { conf } = mockAddTrackFromWidget.mock.lastCall![0] as {
    conf: { adapter: Record<string, unknown> }
  }
  return conf.adapter
}

test('a file-type change drops the index and summary picks', () => {
  const { getAllByTestId, getByLabelText, getByRole } = render(
    <MultiMAFWidget model={model} />,
  )
  fireEvent.click(getByLabelText('MAF (tabix-indexed)'))
  const [data, index, summary] = getAllByTestId('urlInput')
  typeUrl(data!, 'https://x.com/a.taf.gz')
  typeUrl(index!, 'https://x.com/a.maf.gz.tbi')
  typeUrl(summary!, 'https://x.com/summary.bed.gz')

  fireEvent.click(getByLabelText('TAF (Taffy, bgzip-compressed)'))
  fireEvent.click(getByRole('button', { name: 'Submit' }))
  const taf = submittedAdapter()
  expect(taf.taiLocation).toMatchObject({ uri: 'https://x.com/a.taf.gz.tai' })
  expect(taf.summaryAdapter).toBeUndefined()

  typeUrl(getAllByTestId('urlInput')[2]!, 'https://x.com/summary.bed.gz')
  fireEvent.click(getByLabelText('bigMaf'))
  fireEvent.click(getByRole('button', { name: 'Submit' }))
  expect(submittedAdapter().summaryAdapter).toBeUndefined()
})

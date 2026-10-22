import { types } from '@jbrowse/mobx-state-tree'
import { act, render, screen } from '@testing-library/react'

import { SyntenyStack } from './SyntenyStack.tsx'

import type { LinearSyntenyViewModel } from './model.ts'
import type { ViewStatus } from '@jbrowse/core/util/viewStatus'

jest.mock('../LinearSyntenyViewHelper/SyntenyLevel.tsx', () => ({
  SyntenyLevel: ({ level }: { level: { id: string } }) => (
    <div data-testid="band">{level.id}</div>
  ),
}))

const FakeView = types
  .model({})
  .volatile(() => ({
    status: { type: 'loading', message: 'Loading' } as ViewStatus,
    views: [{ id: 'hg38' }, { id: 'mm39' }, { id: 'rn7' }],
    levels: [{ id: 'hg38-mm39' }, { id: 'mm39-rn7' }],
  }))
  .actions(self => ({
    setStatus(status: ViewStatus) {
      self.status = status
    },
    setWidth() {},
  }))

function fakeView() {
  return FakeView.create() as unknown as LinearSyntenyViewModel & {
    setStatus: (status: ViewStatus) => void
  }
}

test('a stack shows the view status until ready, then rows with a band between each pair', () => {
  const view = fakeView()
  const { container } = render(
    <SyntenyStack
      view={view}
      renderRow={(row, i) => (
        <div data-testid="row">
          {i}:{row.id}
        </div>
      )}
    />,
  )
  expect(screen.getByRole('status').textContent).toBe('Loading')
  expect(screen.queryByTestId('row')).toBeNull()

  act(() => {
    view.setStatus({ type: 'ready' })
  })

  expect(screen.queryByRole('status')).toBeNull()
  expect(
    [...container.querySelectorAll('[data-testid]')].map(e => e.textContent),
  ).toEqual(['0:hg38', 'hg38-mm39', '1:mm39', 'mm39-rn7', '2:rn7'])
})

test('an error status reads as an alert', () => {
  const view = fakeView()
  view.setStatus({ type: 'error', error: new Error('no such assembly') })
  render(<SyntenyStack view={view} renderRow={() => null} />)
  expect(screen.getByRole('alert').textContent).toBe(
    'Could not load: no such assembly',
  )
})

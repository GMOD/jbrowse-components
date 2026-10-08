import { types } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { NavButton, Toolbar } from './toolbar.tsx'

const FakeView = types
  .model({})
  .volatile(() => ({ visited: [] as string[] }))
  .actions(self => ({
    navToLocString(input: string) {
      if (input === 'nowhere') {
        return Promise.reject(new Error('Unknown feature or sequence'))
      }
      self.visited = [...self.visited, input]
      return Promise.resolve()
    },
  }))

const FakeSession = types
  .model({ views: types.array(FakeView) })
  .volatile(() => ({
    rpcManager: {},
    configuration: {},
    errors: [] as string[],
  }))
  .actions(self => ({
    notifyError(message: string) {
      self.errors = [...self.errors, message]
    },
  }))

function fakeSession() {
  return FakeSession.create({ views: [{}] })
}

test('a nav button runs its own handler, then moves the view', async () => {
  const session = fakeSession()
  const view = session.views[0]!
  const onClick = jest.fn()
  render(
    <Toolbar>
      <NavButton view={view} loc="chr17:1..100" onClick={onClick}>
        BRCA1
      </NavButton>
    </Toolbar>,
  )
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'BRCA1' }))
  })
  expect(onClick).toHaveBeenCalledTimes(1)
  expect(view.visited).toEqual(['chr17:1..100'])
  expect(session.errors).toEqual([])
})

test('a location the view cannot resolve reaches the session as an error', async () => {
  const session = fakeSession()
  render(<NavButton view={session.views[0]!} loc="nowhere" />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'nowhere' }))
  })
  expect(session.errors).toEqual(['Error: Unknown feature or sequence'])
})

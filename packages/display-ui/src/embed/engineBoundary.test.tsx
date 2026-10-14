import { fireEvent, render, screen } from '@testing-library/react'

import { EngineBoundary } from './engineBoundary.tsx'

test('a build that throws from render draws the error, and retry builds again', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  let hubIsDown = true
  function Engine() {
    if (hubIsDown) {
      throw new Error('hub not-a-genome: 404')
    }
    return <span>built</span>
  }
  render(
    <EngineBoundary>
      <Engine />
    </EngineBoundary>,
  )
  expect(screen.getByRole('alert').textContent).toContain(
    'Could not build the view: hub not-a-genome: 404',
  )
  hubIsDown = false
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(screen.getByText('built')).toBeTruthy()
})

test('a host fallback replaces the default one', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  function Engine(): React.ReactNode {
    throw new Error('no plugin')
  }
  render(
    <EngineBoundary fallback={({ error }) => <p>{`${error}`}</p>}>
      <Engine />
    </EngineBoundary>,
  )
  expect(screen.getByText('Error: no plugin')).toBeTruthy()
})

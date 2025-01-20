import { fireEvent, within } from '@testing-library/react'

// local
import { createView, doBeforeEach, expectCanvasMatch, setup } from './util'
setup()

jest.mock('../makeWorkerInstance', () => () => {})

const delay = { timeout: 20000 }
beforeEach(() => {
  doBeforeEach()
})
afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

// onAction listener warning
console.warn = jest.fn()

test('open tracklist file', async () => {
  const { session, findByTestId, findByRole, findAllByTestId, findByText } =
    await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Linear synteny view'))
  expect(session.views.length).toBe(2)
  const r = await findAllByTestId('assembly-selector-textfield')

  expect(r.length).toBe(2)

  const combo = within(r[1]!)
  const entry = await combo.findByText('volvox')
  fireEvent.mouseDown(entry)

  const listbox = within(await findByRole('listbox'))
  fireEvent.click(listbox.getByText('volvox_del'))
  fireEvent.click(await findByText('Launch'))

  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 40000)

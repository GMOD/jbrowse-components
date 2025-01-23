import { fireEvent, within } from '@testing-library/react'

// local
import { createView, doBeforeEach, expectCanvasMatch, setup } from './util'
setup()

jest.mock('../makeWorkerInstance', () => () => {})

const delay = { timeout: 30000 }
beforeEach(() => {
  doBeforeEach()
})

// onAction listener warning
console.warn = jest.fn()

test('open tracklist file', async () => {
  const { session, findByTestId, findByRole, findAllByTestId, findByText } =
    await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Dotplot view'))
  expect(session.views.length).toBe(2)
  const r = await findAllByTestId('assembly-selector-textfield')

  expect(r.length).toBe(2)

  const combo = within(r[1]!)
  const entry = await combo.findByText('volvox')
  fireEvent.mouseDown(entry)

  const listbox = within(await findByRole('listbox'))
  fireEvent.click(listbox.getByText('volvox_del'))
  fireEvent.click(await findByText('Launch'))

  expectCanvasMatch(await findByTestId('prerendered_canvas_done', {}, delay))
}, 40000)

test('open local', async () => {
  const { session, findByTestId, findByRole, findAllByTestId, findByText } =
    await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Dotplot view'))
  expect(session.views.length).toBe(2)

  const r = await findAllByTestId('assembly-selector-textfield')
  fireEvent.mouseDown(await within(r[0]!).findByText('volvox'))
  fireEvent.click(within(await findByRole('listbox')).getByText('volvox_del'))

  fireEvent.click(await findByText('New track'))
  fireEvent.change(await findByTestId('urlInput'), {
    target: {
      value: 'volvox_del.paf',
    },
  })

  fireEvent.click(await findByText('Swap?'))
  fireEvent.click(await findByText('Launch'))
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', {}, delay))
}, 40000)

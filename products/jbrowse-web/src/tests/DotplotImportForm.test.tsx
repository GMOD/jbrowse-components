import { fireEvent, within } from '@testing-library/react'

import { createView, doBeforeEach, expectCanvasMatch, setup } from './util.tsx'
setup()

const delay = { timeout: 50000 }
beforeEach(() => {
  doBeforeEach()
  jest.spyOn(console, 'warn').mockImplementation() // onAction listener warning
})

afterEach(() => {
  jest.restoreAllMocks()
})

test('open tracklist file', async () => {
  const { session, findByTestId, findByRole, findAllByRole, findByText } =
    await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Dotplot view'))
  expect(session.views.length).toBe(2)
  const r = await findAllByRole('combobox', { name: 'Assembly', hidden: true })

  expect(r.length).toBe(2)

  fireEvent.mouseDown(r[1]!)

  const listbox = within(await findByRole('listbox'))
  fireEvent.click(listbox.getByText('volvox_del'))
  fireEvent.click(await findByText('Launch'))

  expectCanvasMatch(await findByTestId('dotplot_webgl_canvas_done', {}, delay))
}, 50000)

test('open local paf', async () => {
  const { session, findByTestId, findByRole, findAllByRole, findByText } =
    await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Dotplot view'))
  expect(session.views.length).toBe(2)

  const r = await findAllByRole('combobox', { name: 'Assembly', hidden: true })
  fireEvent.mouseDown(r[0]!)
  fireEvent.click(within(await findByRole('listbox')).getByText('volvox_del'))

  fireEvent.click(await findByText('New track'))
  fireEvent.click(await findByText('.paf'))
  fireEvent.change(await findByTestId('urlInput'), {
    target: {
      value: 'volvox_del.paf',
    },
  })

  fireEvent.click(await findByText('Swap?'))
  fireEvent.click(await findByText('Launch'))
  expectCanvasMatch(await findByTestId('dotplot_webgl_canvas_done', {}, delay))
}, 50000)

test('open local pif', async () => {
  const {
    session,
    findByTestId,
    findByRole,
    findAllByRole,
    findAllByTestId,
    findByText,
  } = await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Dotplot view'))
  expect(session.views.length).toBe(2)

  const r = await findAllByRole('combobox', { name: 'Assembly', hidden: true })
  fireEvent.mouseDown(r[0]!)
  fireEvent.click(within(await findByRole('listbox')).getByText('volvox_del'))

  fireEvent.click(await findByText('New track'))
  fireEvent.click(await findByText('.pif.gz'))

  const inputs = await findAllByTestId('urlInput')
  fireEvent.change(inputs[0]!, {
    target: {
      value: 'volvox_del.pif.gz',
    },
  })
  fireEvent.change(inputs[1]!, {
    target: {
      value: 'volvox_del.pif.gz.tbi',
    },
  })

  fireEvent.click(await findByText('Swap?'))
  fireEvent.click(await findByText('Launch'))
  expectCanvasMatch(await findByTestId('dotplot_webgl_canvas_done', {}, delay))
}, 50000)

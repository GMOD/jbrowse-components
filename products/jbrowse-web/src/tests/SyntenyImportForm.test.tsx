import { fireEvent, waitFor, within } from '@testing-library/react'

import { createView, doBeforeEach, expectCanvasMatch, setup } from './util.tsx'

setup()

const delay = { timeout: 20000 }
beforeEach(() => {
  doBeforeEach()
  jest.spyOn(console, 'warn').mockImplementation()
})
afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  jest.restoreAllMocks()
})

test('three level', async () => {
  const { session, queryAllByTestId } = await createView()
  session.addView('LinearSyntenyView', {
    init: {
      views: [
        { assembly: 'volvox_del' },
        { assembly: 'volvox' },
        { assembly: 'volvox_ins' },
      ],
      tracks: [['volvox_del.paf'], ['volvox_ins.paf']],
    },
  })
  const canvases = await waitFor(() => {
    const found = queryAllByTestId('synteny_canvas_done')
    expect(found).toHaveLength(2)
    return found
  }, delay)
  expectCanvasMatch(canvases[0]!)
  expectCanvasMatch(canvases[1]!)
}, 40000)

test('open tracklist file', async () => {
  const { session, findByTestId, findByRole, findByText } =
    await createView()

  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Linear synteny view'))
  expect(session.views.length).toBe(2)
  fireEvent.mouseDown(
    await findByRole('combobox', { name: 'Row 2 assembly' }),
  )
  fireEvent.click(within(await findByRole('listbox')).getByText('volvox_del'))
  fireEvent.click(await findByText('Launch'))

  expectCanvasMatch(await findByTestId('synteny_canvas_done', {}, delay))
}, 40000)

test('open local paf', async () => {
  const { session, findByTestId, findByRole, findByText } =
    await createView()

  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Linear synteny view'))
  expect(session.views.length).toBe(2)

  fireEvent.mouseDown(
    await findByRole('combobox', { name: 'Row 1 assembly' }),
  )
  fireEvent.click(within(await findByRole('listbox')).getByText('volvox_del'))

  fireEvent.click(await findByText('New track'))
  fireEvent.click(await findByText('.paf'))

  fireEvent.change(await findByTestId('urlInput'), {
    target: {
      value: 'volvox_del.paf',
    },
  })

  fireEvent.click(await findByText('Launch'))
  expectCanvasMatch(await findByTestId('synteny_canvas_done', {}, delay))
}, 40000)

test('open local pif', async () => {
  const {
    session,
    findByTestId,
    findByRole,
    findAllByTestId,
    findByText,
  } = await createView()

  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Linear synteny view'))
  expect(session.views.length).toBe(2)

  fireEvent.mouseDown(
    await findByRole('combobox', { name: 'Row 1 assembly' }),
  )
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

  fireEvent.click(await findByText('Launch'))
  expectCanvasMatch(await findByTestId('synteny_canvas_done', {}, delay))
}, 40000)

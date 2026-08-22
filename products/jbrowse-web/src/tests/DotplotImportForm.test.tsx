import { fireEvent, waitFor, within } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findDisplayPainted,
  setup,
} from './util.tsx'

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
  const { session, findByRole, findByText } = await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Dotplot view'))
  await waitFor(() => {
    expect(session.views.length).toBe(2)
  })
  fireEvent.click(await findByText('Manual'))
  fireEvent.mouseDown(
    await findByRole('combobox', { name: 'Y-axis assembly', hidden: true }),
  )

  const listbox = within(await findByRole('listbox'))
  fireEvent.click(listbox.getByText('volvox_del'))
  fireEvent.click(await findByText('Launch'))

  expectCanvasMatch(await findDisplayPainted('dotplot_webgl_canvas', delay))
}, 50000)

test('open local paf', async () => {
  const { session, findByTestId, findByRole, findByText } = await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Dotplot view'))
  await waitFor(() => {
    expect(session.views.length).toBe(2)
  })
  fireEvent.click(await findByText('Manual'))

  fireEvent.mouseDown(
    await findByRole('combobox', { name: 'X-axis assembly', hidden: true }),
  )
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
  expectCanvasMatch(await findDisplayPainted('dotplot_webgl_canvas', delay))
}, 50000)

test('open local pif', async () => {
  const { session, findByRole, findAllByTestId, findByText } =
    await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Dotplot view'))
  await waitFor(() => {
    expect(session.views.length).toBe(2)
  })
  fireEvent.click(await findByText('Manual'))

  fireEvent.mouseDown(
    await findByRole('combobox', { name: 'X-axis assembly', hidden: true }),
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

  fireEvent.click(await findByText('Swap?'))
  fireEvent.click(await findByText('Launch'))
  expectCanvasMatch(await findDisplayPainted('dotplot_webgl_canvas', delay))
}, 50000)

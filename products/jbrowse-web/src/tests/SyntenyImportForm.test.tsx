import { fireEvent, waitFor, within } from '@testing-library/react'

import { createView, doBeforeEach, expectCanvasMatch, setup } from './util.tsx'
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

  fireEvent.mouseDown(await within(r[1]!).findByText('volvox'))
  fireEvent.click(within(await findByRole('listbox')).getByText('volvox_del'))
  fireEvent.click(await findByText('Launch'))

  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 40000)

test('open local paf', async () => {
  const { session, findByTestId, findByRole, findAllByTestId, findByText } =
    await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Linear synteny view'))
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

  fireEvent.click(await findByText('Launch'))
  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 40000)

test('pangenome mode selects MultiSyntenyTrack and launches', async () => {
  const { session, findByText, findByRole } = await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Linear synteny view'))
  expect(session.views.length).toBe(2)

  fireEvent.click(await findByText('Pangenome / multi-way'))

  await findByText('volvox/volvox_del GFA (MultiLGV)')

  expect(await findByRole('checkbox', { name: 'volvox' })).toBeChecked()
  expect(await findByRole('checkbox', { name: 'volvox_del' })).toBeChecked()

  fireEvent.click(await findByText('Launch'))

  await waitFor(() => {
    const syntenyView = session.views[1]!
    expect((syntenyView as any).views.length).toBe(2)
  }, delay)
}, 40000)

test('open local pif', async () => {
  const { session, findByTestId, findByRole, findAllByTestId, findByText } =
    await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Linear synteny view'))
  expect(session.views.length).toBe(2)

  const r = await findAllByTestId('assembly-selector-textfield')
  fireEvent.mouseDown(await within(r[0]!).findByText('volvox'))
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
  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 40000)

import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  hts,
  setup,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }

test('launch read vs ref panel', async () => {
  const consoleMock = jest.spyOn(console, 'warn').mockImplementation()
  const { view, findByTestId, findByText } = await createView()
  view.setNewView(5, 100)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), {}, delay),
  )

  const display = await findByTestId('pileup-display-done', {}, delay)
  const canvas = findCanvasIn(display)
  fireEvent.mouseMove(canvas, { clientX: 200, clientY: 80 })
  fireEvent.click(canvas, { clientX: 200, clientY: 80 })
  fireEvent.contextMenu(canvas, { clientX: 200, clientY: 80 })

  fireEvent.click(await findByText('Linear read vs ref', {}, delay))
  const elt = await findByText('Submit', {}, delay)

  await waitFor(() => {
    expect(elt.getAttribute('disabled')).toBe(null)
  })
  fireEvent.click(elt)

  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
  consoleMock.mockRestore()
}, 40000)

test('launch read vs ref dotplot', async () => {
  const { view, findByTestId, findByText } = await createView()
  view.setNewView(5, 100)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), {}, delay),
  )

  const display = await findByTestId('pileup-display-done', {}, delay)
  const canvas = findCanvasIn(display)
  fireEvent.mouseMove(canvas, { clientX: 200, clientY: 80 })
  fireEvent.click(canvas, { clientX: 200, clientY: 80 })
  fireEvent.contextMenu(canvas, { clientX: 200, clientY: 80 })

  fireEvent.click(await findByText('Dotplot of read vs ref', {}, delay))
  expectCanvasMatch(await findByTestId('dotplot_webgl_canvas_done', {}, delay))
}, 40000)

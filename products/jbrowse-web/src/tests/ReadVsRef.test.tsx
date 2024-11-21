import { fireEvent, waitFor } from '@testing-library/react'

// locals
import { hts, doBeforeEach, createView, setup, expectCanvasMatch } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }

test('launch read vs ref panel', async () => {
  const consoleMock = jest.spyOn(console, 'warn').mockImplementation()
  const { view, findByTestId, findByText, findAllByTestId } = await createView()
  view.setNewView(5, 100)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), {}, delay),
  )

  const track = await findAllByTestId('pileup-overlay-normal', {}, delay)
  fireEvent.mouseMove(track[0]!, { clientX: 200, clientY: 20 })
  fireEvent.click(track[0]!, { clientX: 200, clientY: 40 })
  fireEvent.contextMenu(track[0]!, { clientX: 200, clientY: 20 })
  fireEvent.click(await findByText('Linear read vs ref', {}, delay))
  const elt = await findByText('Submit', {}, delay)

  // https://stackoverflow.com/a/62443937/2129219
  await waitFor(() => {
    expect(elt.getAttribute('disabled')).toBe(null)
  })
  fireEvent.click(elt)

  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
  consoleMock.mockRestore()
}, 40000)

test('launch read vs ref dotplot', async () => {
  const { view, findByTestId, findByText, findAllByTestId } = await createView()
  view.setNewView(5, 100)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), {}, delay),
  )

  const track = await findAllByTestId('pileup-overlay-normal', {}, delay)
  fireEvent.mouseMove(track[0]!, { clientX: 200, clientY: 20 })
  fireEvent.click(track[0]!, { clientX: 200, clientY: 40 })
  fireEvent.contextMenu(track[0]!, { clientX: 200, clientY: 20 })
  fireEvent.click(await findByText('Dotplot of read vs ref', {}, delay))
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', {}, delay))
}, 40000)

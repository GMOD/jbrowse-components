import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  hts,
  setup,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }

async function setupReadVsRefTest() {
  const { view, findByTestId, findByText, findAllByTestId } = await createView()
  view.setNewView(5, 100)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), {}, delay),
  )

  const track = await findAllByTestId('pileup-overlay-normal', {}, delay)
  fireEvent.mouseMove(track[0]!, { clientX: 200, clientY: 20 })
  fireEvent.click(track[0]!, { clientX: 200, clientY: 40 })
  fireEvent.contextMenu(track[0]!, { clientX: 200, clientY: 20 })

  return { findByTestId, findByText }
}

test('launch read vs ref panel', async () => {
  const consoleMock = jest.spyOn(console, 'warn').mockImplementation()
  const { findByTestId, findByText } = await setupReadVsRefTest()

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
  const { findByTestId, findByText } = await setupReadVsRefTest()

  fireEvent.click(await findByText('Dotplot of read vs ref', {}, delay))
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', {}, delay))
}, 40000)

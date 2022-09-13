import { fireEvent, waitFor } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

// locals
import { hts, doBeforeEach, createView, setup, expectCanvasMatch } from './util'

expect.extend({ toMatchImageSnapshot })
setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }

test('launch read vs ref panel', async () => {
  console.warn = jest.fn()

  const { session, view, findByTestId, findByText, findAllByTestId } =
    createView()

  await findByText('Help')
  view.setNewView(5, 100)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), {}, delay),
  )

  const track = await findAllByTestId('pileup_overlay_canvas', {}, delay)
  fireEvent.mouseMove(track[0], { clientX: 200, clientY: 20 })
  fireEvent.click(track[0], { clientX: 200, clientY: 40 })
  fireEvent.contextMenu(track[0], { clientX: 200, clientY: 20 })
  fireEvent.click(await findByText('Linear read vs ref', {}, delay))
  const elt = await findByText('Submit')

  // https://stackoverflow.com/a/62443937/2129219
  await waitFor(() => expect(elt.getAttribute('disabled')).toBe(null))
  fireEvent.click(elt)

  expect(session.views[1].type).toBe('LinearSyntenyView')
  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 20000)

test('launch read vs ref dotplot', async () => {
  console.warn = jest.fn()
  const { session, view, findByTestId, findByText, findAllByTestId } =
    createView()

  await findByText('Help')
  view.setNewView(5, 100)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), {}, delay),
  )

  const track = await findAllByTestId('pileup_overlay_canvas', {}, delay)
  fireEvent.mouseMove(track[0], { clientX: 200, clientY: 20 })
  fireEvent.click(track[0], { clientX: 200, clientY: 40 })
  fireEvent.contextMenu(track[0], { clientX: 200, clientY: 20 })
  fireEvent.click(await findByText('Dotplot of read vs ref', {}, delay))

  expect(session.views[1].type).toBe('DotplotView')
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', {}, delay))
}, 20000)

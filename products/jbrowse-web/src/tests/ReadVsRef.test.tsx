import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  findDisplayPainted,
  hts,
  mockConsoleWarn,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

// only the track this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['volvox_alignments_pileup_coverage'])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }

test('launch read vs ref panel', async () => {
  const consoleMock = jest.spyOn(console, 'warn').mockImplementation()
  const { view, findByTestId, findByText } = await createView(config)
  view.setNewView(5, 100)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), {}, delay),
  )

  const display = await findDisplayPainted('pileup-display', delay)
  const canvas = findCanvasIn(display)
  fireEvent.mouseMove(canvas, { clientX: 200, clientY: 80 })
  fireEvent.click(canvas, { clientX: 200, clientY: 80 })
  fireEvent.contextMenu(canvas, { clientX: 200, clientY: 80 })

  fireEvent.click(await findByText(/Launch/, {}, delay))
  fireEvent.click(await findByText('Linear read vs ref', {}, delay))
  const elt = await findByText('Open in new view', {}, delay)

  await waitFor(() => {
    expect(elt.getAttribute('disabled')).toBe(null)
  })
  fireEvent.click(elt)

  expectCanvasMatch(await findDisplayPainted('synteny_canvas', delay))
  consoleMock.mockRestore()
}, 40000)

test('launch read vs ref dotplot', async () => {
  const { view, session, findByTestId, findByText } = await createView(config)
  view.setNewView(5, 100)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), {}, delay),
  )

  const display = await findDisplayPainted('pileup-display', delay)
  const canvas = findCanvasIn(display)
  fireEvent.mouseMove(canvas, { clientX: 200, clientY: 80 })
  fireEvent.click(canvas, { clientX: 200, clientY: 80 })
  fireEvent.contextMenu(canvas, { clientX: 200, clientY: 80 })

  fireEvent.click(await findByText(/Launch/, {}, delay))
  fireEvent.click(await findByText('Dotplot of read vs ref', {}, delay))

  // Both launchers share one dialog: it resolves the clicked segment to its
  // primary alignment (so the read axis is the read's own orientation, not the
  // clicked segment's) and asks for a window size. The view is added by its
  // onSubmit, so nothing happens until the button is enabled and clicked.
  const elt = await findByText('Open in new view', {}, delay)
  await waitFor(() => {
    expect(elt.getAttribute('disabled')).toBe(null)
  }, delay)
  fireEvent.click(elt)

  await waitFor(() => {
    expect(session.views.length).toBe(2)
    expect(session.views[1]!.type).toBe('DotplotView')
  }, delay)

  // the synthetic read assembly must be registered for the view to leave the
  // loading state; without addTemporaryAssembly it stays initialized=false
  const dotplotView = session.views[1] as unknown as { initialized: boolean }
  await waitFor(() => {
    expect(dotplotView.initialized).toBe(true)
  }, delay)
}, 40000)

// The dialog's other way out. Same launcher, same spec: the only difference is
// that the dotplot lands in the pileup view's slot rather than below it, which
// is what session.views says and the canvas cannot.
test('replace the launching view with the read vs ref dotplot', async () => {
  // mocked because replacing destroys the pileup view's subtree while its
  // observers are still mounted (React unmounts a commit later), so MobX
  // re-evaluates their reads across the dead nodes and MST's livelinessChecking
  // warns. Nothing throws and the render never commits.
  await mockConsoleWarn(async () => {
    const { view, session, findByTestId, findByText } = await createView(config)
    view.setNewView(5, 100)
    fireEvent.click(
      await findByTestId(hts('volvox_alignments_pileup_coverage'), {}, delay),
    )

    const display = await findDisplayPainted('pileup-display', delay)
    const canvas = findCanvasIn(display)
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 80 })
    fireEvent.click(canvas, { clientX: 200, clientY: 80 })
    fireEvent.contextMenu(canvas, { clientX: 200, clientY: 80 })

    fireEvent.click(await findByText(/Launch/, {}, delay))
    fireEvent.click(await findByText('Dotplot of read vs ref', {}, delay))

    const elt = await findByText('Replace current view', {}, delay)
    await waitFor(() => {
      expect(elt.getAttribute('disabled')).toBe(null)
    }, delay)
    fireEvent.click(elt)

    await waitFor(() => {
      expect(session.views.map(v => v.type)).toEqual(['DotplotView'])
    }, delay)
  })
}, 40000)

import { saveAs } from '@jbrowse/core/util'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import {
  createView,
  doBeforeEach,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

jest.mock('@jbrowse/core/util/FileSaver', () => {
  return {
    ...jest.requireActual('@jbrowse/core/util/FileSaver'),
    saveAs: jest.fn(),
  }
})
setup()

// nothing here reads the track list: the one track reference is
// `findByTestId('tracksContainer')`, which is the LGV's own container - see
// volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['volvox_alignments'])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

const region = {
  start: 200,
  end: 240,
  refName: 'ctgA',
  assemblyName: 'volvox',
}

// the region the view shows at load, which "the current region" highlights
const currentRegion = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 100,
  end: 141,
}

// focus the view to allow the hotkey to work (it has a focus guard).
// userEvent, not fireEvent: only a real pointer sequence focuses the
// container. fireEvent.click fires the click alone, leaving activeElement on
// <body> so the guard rejects the keydown.
async function focusView(findByTestId: (id: string) => Promise<HTMLElement>) {
  await userEvent.setup().click(await findByTestId('tracksContainer'))
}

function pressHotkey(code: string) {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { code, shiftKey: true, ctrlKey: true }),
  )
}

test('Open the highlight list from the top level menu', async () => {
  const { findByTestId, findByText } = await createView(config)

  fireEvent.click(await findByText('Tools'))
  fireEvent.click(await findByText('Highlights'))

  expect(await findByTestId('grid_bookmark_menu', ...opts)).toBeTruthy()
}, 60000)

test('Open the highlight list from the view menu', async () => {
  const { findByTestId, findByText } = await createView(config)

  fireEvent.click(await findByTestId('view_menu_icon'))
  fireEvent.click(await findByText('Open highlight list'))

  expect(await findByTestId('grid_bookmark_menu', ...opts)).toBeTruthy()
}, 60000)

test('Highlight a region with the click and drag rubberband', async () => {
  const { session, findByTestId, findByText } = await createView(config)
  const rubberband = await findByTestId('rubberband_controls', {}, delay)

  fireEvent.mouseDown(rubberband, { clientX: 100, clientY: 0 })
  fireEvent.mouseMove(rubberband, { clientX: 250, clientY: 0 })
  fireEvent.mouseUp(rubberband, { clientX: 250, clientY: 0 })
  fireEvent.click(await findByText('Highlight region'))

  expect(session.highlights).toEqual([
    { assemblyName: 'volvox', refName: 'ctgA', start: 105, end: 113 },
  ])
}, 40000)

test('Highlight the current region with the hotkey', async () => {
  const { session, findByTestId } = await createView(config)

  await focusView(findByTestId)
  pressHotkey('KeyD')

  expect(session.highlights).toEqual([currentRegion])
}, 60000)

test('Hide the bands from the view menu', async () => {
  const { session, findByTestId, findByText } = await createView(config)

  fireEvent.click(await findByTestId('view_menu_icon'))
  fireEvent.click(await findByText('Show...'))
  fireEvent.click(await findByText('Show highlights'))

  expect(session.highlightsVisible).toBe(false)
}, 40000)

test('Navigate to a highlight with the link in the list', async () => {
  const { view, session, findByTestId, findByText } = await createView(config)

  fireEvent.click(await findByTestId('view_menu_icon'))
  fireEvent.click(await findByText('Open highlight list'))
  session.addHighlight(region)

  fireEvent.click(await findByText('ctgA:201..240', {}, delay))
  // navigation grows the region by 0.2 for context, so a 40bp highlight
  // (ctgA:201..240) lands zoomed out by 8bp on each side
  await waitFor(() => {
    expect(view.visibleLocStrings).toBe('ctgA:193..248')
  })
}, 40000)

test('Navigate to the newest highlight with the hotkey', async () => {
  const { view, session, findByTestId } = await createView(config)
  session.addHighlight(region)

  await focusView(findByTestId)
  pressHotkey('KeyM')

  // the hotkey navigates the way the list's link does
  await waitFor(() => {
    expect(view.visibleLocStrings).toBe('ctgA:193..248')
  })
}, 40000)

test('Edit a highlight label with a single click in the list', async () => {
  const { session, findByText, findAllByRole } = await createView(config)

  fireEvent.click(await findByText('Tools'))
  fireEvent.click(await findByText('Highlights'))
  session.addHighlight(region)

  const field = (await findAllByRole('gridcell'))[2]!
  // userEvent, not fireEvent.change: the grid cell is a <div>, not an input, so
  // it has no value setter for a change event to drive. Typing goes to whatever
  // the click focused, which is the editor the grid mounts.
  await userEvent.setup().type(field, 'new label{Enter}')

  await waitFor(() => {
    expect(session.highlights[0]!.label).toBe('new label')
  })
  expect(field.textContent).toContain('new label')
}, 60000)

test('Toggle highlight visibility across all views', async () => {
  const { session, findByText, findByTestId } = await createView(config)

  session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volvox',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })

  fireEvent.click(await findByText('Tools'))
  fireEvent.click(await findByText('Highlights'))
  session.addHighlight(region)

  // the highlight draws a band in each open view (both on volvox)
  await waitFor(() => {
    expect(screen.getAllByTestId('highlight-band').length).toBeGreaterThan(1)
  }, delay)

  fireEvent.click(await findByTestId('grid_bookmark_menu', ...opts))
  fireEvent.click(await findByText('Show highlights on views'))

  // one session-wide flag hides the bands in every view
  await waitFor(() => {
    expect(screen.queryAllByTestId('highlight-band').length).toBe(0)
  }, delay)
}, 60000)

test('Downloads a BED file correctly', async () => {
  const { session, findByText, findByTestId } = await createView(config)

  session.showWidget(
    session.addWidget('GridBookmarkWidget', 'gridBookmarkWidget'),
  )
  session.addHighlight({ ...region, start: 0, end: 8 })

  fireEvent.click(await findByTestId('grid_bookmark_menu', ...opts))
  fireEvent.click(await findByText('Export', ...opts))
  fireEvent.click(await findByText(/Download/, ...opts))

  await waitFor(() => {
    expect(saveAs).toHaveBeenCalled()
  }, delay)

  const blob = new Blob([''], {
    type: 'text/x-bed;charset=utf-8',
  })

  expect(saveAs).toHaveBeenCalledWith(blob, 'jbrowse_highlights_volvox.bed')
}, 60000)

test('Downloads a TSV file correctly', async () => {
  const { session, findByText, findByTestId, getByRole } =
    await createView(config)

  session.showWidget(
    session.addWidget('GridBookmarkWidget', 'gridBookmarkWidget'),
  )
  session.addHighlight({ ...region, start: 0, end: 8 })

  fireEvent.click(await findByTestId('grid_bookmark_menu'))
  fireEvent.click(await findByText('Export'))
  fireEvent.mouseDown(await findByText('BED'))
  const listbox = within(getByRole('listbox'))
  fireEvent.click(listbox.getByText('TSV'))
  fireEvent.click(await findByText(/Download/))

  await waitFor(() => {
    expect(saveAs).toHaveBeenCalled()
  }, delay)

  const blob = new Blob([''], {
    type: 'text/tab-separated-values;charset=utf-8',
  })

  expect(saveAs).toHaveBeenCalledWith(blob, 'jbrowse_highlights.tsv')
}, 60000)

import { waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { saveAs } from 'file-saver'
import { createView, setup, doBeforeEach } from './util'

jest.mock('file-saver', () => {
  return {
    ...jest.requireActual('file-saver'),
    saveAs: jest.fn(),
  }
})
setup()

beforeEach(() => {
  doBeforeEach()
  localStorage.clear()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('Open the bookmarks widget from the top level menu', async () => {
  const { findByText } = await createView()

  const user = userEvent.setup()
  await user.click(await findByText('Tools'))
  await user.click(await findByText('Bookmarks'))

  expect(await findByText('Bookmarked regions')).toBeTruthy()
})

test('Open the bookmarks widget from the view menu', async () => {
  const { findByTestId, findByText } = await createView()

  const user = userEvent.setup()
  await user.click(await findByTestId('view_menu_icon'))
  await user.click(await findByText('Open bookmark widget'))

  expect(await findByText('Bookmarked regions')).toBeTruthy()
})

test('Create a bookmark using the click and drag rubberband', async () => {
  const { session, findByTestId, findByText } = await createView()
  const rubberband = await findByTestId('rubberband_controls', {}, delay)

  fireEvent.mouseDown(rubberband, { clientX: 100, clientY: 0 })
  fireEvent.mouseMove(rubberband, { clientX: 250, clientY: 0 })
  fireEvent.mouseUp(rubberband, { clientX: 250, clientY: 0 })
  fireEvent.click(await findByText('Bookmark region'))

  // @ts-expect-error
  const { bookmarks } = session.widgets.get('GridBookmark')
  expect(bookmarks).toMatchSnapshot()
}, 40000)

test('Create a bookmark using the hotkey to bookmark the current region', async () => {
  const { session, findByTestId } = await createView()

  const user = userEvent.setup()
  await user.click(await findByTestId('trackContainer', ...opts))

  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      code: 'KeyD',
      shiftKey: true,
      ctrlKey: true,
    }),
  )

  // @ts-expect-error
  const { bookmarks } = session.widgets.get('GridBookmark')
  expect(bookmarks).toMatchSnapshot()
})

test('Create a bookmark using the menu button to bookmark the current region', async () => {
  const { session, findByTestId, findByText } = await createView()

  const user = userEvent.setup()
  await user.click(await findByTestId('trackContainer', ...opts))
  await user.click(await findByTestId('view_menu_icon'))
  await user.click(await findByText('Bookmarks'))
  await user.click(await findByText('Bookmark current region'))

  // @ts-expect-error
  const { bookmarks } = session.widgets.get('GridBookmark')
  expect(bookmarks).toMatchSnapshot()
}, 40000)

test('Navigate to a bookmark using the embedded link in the widget data grid', async () => {
  const { view, session, findByTestId, findByText } = await createView()

  const user = userEvent.setup()
  await user.click(await findByTestId('view_menu_icon'))
  await user.click(await findByText('Open bookmark widget'))

  // @ts-expect-error
  const bookmarkWidget = session.widgets.get('GridBookmark')
  bookmarkWidget.addBookmark({
    start: 200,
    end: 240,
    refName: 'ctgA',
    assemblyName: 'volvox',
  })

  fireEvent.click(await findByText('ctgA:201..240', {}, delay))
  await waitFor(() => {
    expect(view.visibleLocStrings).toBe('ctgA:201..240')
  })
}, 40000)

test('Navigate to a bookmark using the hotkey to navigate to the most recently created bookmark', async () => {
  const { view, session, findByTestId, findByText } = await createView()

  const user = userEvent.setup()
  await user.click(await findByTestId('view_menu_icon'))
  await user.click(await findByText('Bookmarks'))
  await user.click(await findByText('Open bookmark widget'))

  // @ts-expect-error
  const bookmarkWidget = session.widgets.get('GridBookmark')
  bookmarkWidget.addBookmark({
    start: 200,
    end: 240,
    refName: 'ctgA',
    assemblyName: 'volvox',
  })

  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      code: 'KeyM',
      shiftKey: true,
      ctrlKey: true,
    }),
  )

  await waitFor(() => {
    expect(view.visibleLocStrings).toBe('ctgA:201..240')
  })
}, 40000)

test('Edit a bookmark label with a single click on the data grid', async () => {
  const { session, findByText, findAllByRole } = await createView()

  const user = userEvent.setup()
  await user.click(await findByText('Tools'))
  await user.click(await findByText('Bookmarks'))

  // @ts-expect-error
  const bookmarkWidget = session.widgets.get('GridBookmark')
  bookmarkWidget.addBookmark({
    start: 200,
    end: 240,
    refName: 'ctgA',
    assemblyName: 'volvox',
  })

  const field = (await findAllByRole('gridcell'))[2]!
  await user.type(field, 'new label')
  // get the focus away from the field
  fireEvent.click(document)

  expect(field.innerHTML).toContain('new label')
})
test('Edit a bookmark label with a double click via the dialog', async () => {
  const { session, findByText, findAllByRole, findByTestId } =
    await createView()

  const user = userEvent.setup()
  await user.click(await findByText('Tools'))
  await user.click(await findByText('Bookmarks'))

  // @ts-expect-error
  const bookmarkWidget = session.widgets.get('GridBookmark')
  bookmarkWidget.addBookmark({
    start: 200,
    end: 240,
    refName: 'ctgA',
    assemblyName: 'volvox',
  })

  const field = (await findAllByRole('gridcell'))[2]!

  await user.dblClick(field)
  await user.type(await findByTestId('edit-bookmark-label-field'), 'new label')
  await user.click(await findByText('Confirm'))
  expect(field.innerHTML).toContain('new label')
})

test('Toggle highlight visibility across all views', async () => {
  const { session, findByText, findByTestId, findAllByTestId } =
    await createView()

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

  const user = userEvent.setup()

  await user.click(await findByText('Tools'))
  await user.click(await findByText('Bookmarks'))

  // @ts-expect-error
  const bookmarkWidget = session.widgets.get('GridBookmark')
  bookmarkWidget.addBookmark({
    start: 200,
    end: 240,
    refName: 'ctgA',
    assemblyName: 'volvox',
  })

  const highlight = (await findAllByTestId('BookmarkIcon'))[0]
  const highlight2 = (await findAllByTestId('BookmarkIcon'))[1]

  expect(highlight).toBeDefined()
  expect(highlight2).toBeDefined()

  fireEvent.click(await findByTestId('grid_bookmark_menu', ...opts))
  await user.click(await findByText('Settings'))
  await user.click(await findByTestId('toggle_highlight_all_switch'))
  await user.click(await findByText('Close'))

  // expect(highlight3).toBeUndefined()
  // expect(highlight4).toBeUndefined()
})

test('Toggle highlight label visibility across all views', async () => {
  const { session, findByText, findByTestId } = await createView()

  const user = userEvent.setup()

  await user.click(await findByText('Tools'))
  await user.click(await findByText('Bookmarks'))

  // @ts-expect-error
  const bookmarkWidget = session.widgets.get('GridBookmark')
  bookmarkWidget.addBookmark({
    start: 200,
    end: 240,
    refName: 'ctgA',
    assemblyName: 'volvox',
  })

  // const highlight = (await findAllByTestId('BookmarkIcon'))[0]
  // const highlight2 = (await findAllByTestId('BookmarkIcon'))[1]

  // expect(highlight).toBeDefined()
  // expect(highlight2).toBeDefined()

  fireEvent.click(await findByTestId('grid_bookmark_menu', ...opts))
  await user.click(await findByText('Settings'))
  await user.click(await findByTestId('toggle_highlight_label_all_switch'))
  await user.click(await findByText('Close'))

  // expect(highlight).toBeUndefined()
  // expect(highlight2).toBeUndefined()
})

test('Downloads a BED file correctly', async () => {
  const { session, findByText, findByTestId } = await createView()

  // @ts-expect-error
  const bookmarkWidget = session.addWidget(
    'GridBookmarkWidget',
    'gridBookmarkWidget',
  )
  // @ts-expect-error
  session.showWidget('gridBookmarkWidget')

  bookmarkWidget.addBookmark({
    refName: 'ctgA',
    start: 0,
    end: 8,
    assemblyName: 'volvox',
  })

  fireEvent.click(await findByTestId('grid_bookmark_menu', ...opts))
  fireEvent.click(await findByText('Export', ...opts))
  fireEvent.click(await findByText(/Download/, ...opts))

  const blob = new Blob([''], {
    type: 'text/x-bed;charset=utf-8',
  })

  expect(saveAs).toHaveBeenCalledWith(blob, 'jbrowse_bookmarks_volvox.bed')
}, 20000)

test('Downloads a TSV file correctly', async () => {
  const { session, findByText, findByTestId, getByRole } = await createView()

  // @ts-expect-error
  const bookmarkWidget = session.addWidget(
    'GridBookmarkWidget',
    'gridBookmarkWidget',
  )
  // @ts-expect-error
  session.showWidget('gridBookmarkWidget')

  bookmarkWidget.addBookmark({
    refName: 'ctgA',
    start: 0,
    end: 8,
    assemblyName: 'volvox',
  })
  fireEvent.click(await findByTestId('grid_bookmark_menu'))
  fireEvent.click(await findByText('Export'))
  fireEvent.mouseDown(await findByText('BED'))
  const listbox = within(getByRole('listbox'))
  fireEvent.click(listbox.getByText('TSV'))
  fireEvent.click(await findByText(/Download/))

  const blob = new Blob([''], {
    type: 'text/tab-separated-values;charset=utf-8',
  })

  expect(saveAs).toHaveBeenCalledWith(blob, 'jbrowse_bookmarks.tsv')
})

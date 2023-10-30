import { waitFor, fireEvent } from '@testing-library/react'

import userEvent from '@testing-library/user-event'
import { createView, setup, doBeforeEach } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
  localStorage.clear()
})

const delay = { timeout: 30000 }

test('from the top level menu', async () => {
  const { findByText } = await createView()

  const user = userEvent.setup()
  await user.click(await findByText('Tools'))
  await user.click(await findByText('Bookmarks'))

  expect(await findByText('Bookmarked regions')).toBeTruthy()
})

test('from the view menu', async () => {
  const { findByTestId, findByText } = await createView()

  const user = userEvent.setup()
  await user.click(await findByTestId('view_menu_icon'))
  await user.click(await findByText('Open bookmark widget'))

  expect(await findByText('Bookmarked regions')).toBeTruthy()
})

test('using the click and drag rubberband', async () => {
  const { session, findByTestId, findByText } = await createView()
  const rubberband = await findByTestId('rubberband_controls', {}, delay)

  fireEvent.mouseDown(rubberband, { clientX: 100, clientY: 0 })
  fireEvent.mouseMove(rubberband, { clientX: 250, clientY: 0 })
  fireEvent.mouseUp(rubberband, { clientX: 250, clientY: 0 })
  fireEvent.click(await findByText('Bookmark region'))

  // @ts-expect-error
  const bookmarkWidget = session.widgets.get('GridBookmark')
  expect(bookmarkWidget.bookmarks[0].assemblyName).toBe('volvox')
}, 40000)

test('using the hotkey to bookmark the current region', async () => {
  const { session, findByTestId } = await createView()

  const user = userEvent.setup()
  await user.click(await findByTestId('trackContainer'))

  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      code: 'KeyD',
      shiftKey: true,
      ctrlKey: true,
    }),
  )

  // @ts-expect-error
  const { bookmarks } = session.widgets.get('GridBookmark')
  expect(bookmarks[0].start).toBe(105)
  expect(bookmarks[0].end).toBe(113)
})

test('using the menu button to bookmark the current region', async () => {
  const { session, findByTestId, findByText } = await createView()

  const user = userEvent.setup()
  await user.click(await findByTestId('trackContainer'))
  await user.click(await findByTestId('view_menu_icon'))
  await user.click(await findByText('Bookmark current region'))

  // @ts-expect-error
  const { bookmarks } = session.widgets.get('GridBookmark')
  expect(bookmarks.length).toBe(1)
  expect(bookmarks[0].start).toBe(100)
  expect(bookmarks[0].end).toBe(140)
}, 40000)

test('using the embedded link in the widget data grid', async () => {
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
  await waitFor(() => expect(view.visibleLocStrings).toBe('ctgA:201..240'))
}, 40000)

test('using the hotkey to navigate to the most recently created bookmark', async () => {
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

  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      code: 'KeyM',
      shiftKey: true,
      ctrlKey: true,
    }),
  )

  await waitFor(() => expect(view.visibleLocStrings).toBe('ctgA:201..240'))
}, 40000)

test('with a single click on the data grid', async () => {
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

  const field = (await findAllByRole('cell'))[2]
  await user.type(field, 'new label')
  // get the focus away from the field
  fireEvent.click(document)

  expect(field.innerHTML).toContain('new label')
})
test('with a double click via the dialog', async () => {
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

  const field = (await findAllByRole('cell'))[2]

  await user.dblClick(field)
  await user.type(await findByTestId('edit-bookmark-label-field'), 'new label')
  await user.click(await findByText('Confirm'))
  expect(field.innerHTML).toContain('new label')
})

import { waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, setup, hts, doBeforeEach } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }

describe('Open the bookmarks widget', () => {
  test('from the top level menu', async () => {
    const { findByText } = await createView()

    fireEvent.click(await findByText('Tools'))
    fireEvent.click(await findByText('Bookmarks'))

    expect(await findByText('Bookmarked regions')).toBeTruthy()
  })
  test('from the view menu', async () => {
    const { findByTestId, findByText } = await createView()

    fireEvent.click(await findByTestId('view_menu_icon'))
    fireEvent.click(await findByText('Open bookmark widget'))

    expect(await findByText('Bookmarked regions')).toBeTruthy()
  })
})

describe('Create a new bookmark', () => {
  test('using the click and drag rubberband', async () => {
    const { session, view, findByTestId, findByText } = await createView()
    const rubberband = await findByTestId('rubberband_controls', {}, delay)

    expect(view.bpPerPx).toEqual(0.05)
    fireEvent.mouseDown(rubberband, { clientX: 100, clientY: 0 })
    fireEvent.mouseMove(rubberband, { clientX: 250, clientY: 0 })
    fireEvent.mouseUp(rubberband, { clientX: 250, clientY: 0 })
    fireEvent.click(await findByText('Bookmark region'))

    // @ts-expect-error
    const { widgets } = session
    const bookmarkWidget = widgets.get('GridBookmark')
    expect(bookmarkWidget.bookmarkedRegions[0].assemblyName).toEqual('volvox')
  }, 40000)
  test('using the hotkey to bookmark the current region', async () => {
    const { session, findByTestId } = await createView()

    const container = await findByTestId('trackContainer')
    fireEvent.mouseDown(container)

    const event = new KeyboardEvent('keydown', {
      code: 'KeyD',
      shiftKey: true,
      ctrlKey: true,
    })

    document.dispatchEvent(event)

    // @ts-expect-error
    const { widgets } = session
    const { bookmarkedRegions } = widgets.get('GridBookmark')
    expect(bookmarkedRegions[0].start).toEqual(105)
    expect(bookmarkedRegions[0].end).toEqual(113)
  })
  test('using the menu button to bookmark the current region', async () => {
    const { session, findByTestId, findByText } = await createView()

    fireEvent.mouseDown(await findByTestId('trackContainer'))
    fireEvent.click(await findByTestId('view_menu_icon'))
    fireEvent.click(await findByText('Bookmark current region'))

    // @ts-expect-error
    const { widgets } = session
    const { bookmarkedRegions } = widgets.get('GridBookmark')
    expect(bookmarkedRegions[0].start).toEqual(100)
    expect(bookmarkedRegions[0].end).toEqual(140)
  }, 40000)
})

describe('Navigate to a bookmark', () => {
  test('using the embedded link in the widget data grid', async () => {
    const { view, session, findByTestId, findByText } = await createView()

    // need this to complete before we can try to navigate
    fireEvent.click(await findByTestId(hts('volvox_alignments'), {}, delay))
    await findByTestId(
      'trackRenderingContainer-integration_test-volvox_alignments',
      {},
      delay,
    )

    fireEvent.click(await findByTestId('view_menu_icon'))
    fireEvent.click(await findByText('Open bookmark widget'))

    // @ts-expect-error
    const { widgets } = session
    const bookmarkWidget = widgets.get('GridBookmark')
    bookmarkWidget.addBookmark({
      start: 200,
      end: 240,
      refName: 'ctgA',
      assemblyName: 'volvox',
    })

    fireEvent.click(await findByText('ctgA:201..240', {}, delay))
    await waitFor(() =>
      expect(
        view.getSelectedRegions(view.leftOffset, view.rightOffset)[0].key,
      ).toEqual('{volvox}ctgA:201..240-0'),
    )
  }, 40000)
  test('using the hotkey to navigate to the most recently created bookmark', async () => {
    const { view, session, findByTestId, findByText } = await createView()

    // need this to complete before we can try to navigate
    fireEvent.click(await findByTestId(hts('volvox_alignments'), {}, delay))
    await findByTestId(
      'trackRenderingContainer-integration_test-volvox_alignments',
      {},
      delay,
    )

    fireEvent.click(await findByTestId('view_menu_icon'))
    fireEvent.click(await findByText('Open bookmark widget'))

    // @ts-expect-error
    const { widgets } = session
    const bookmarkWidget = widgets.get('GridBookmark')
    bookmarkWidget.addBookmark({
      start: 200,
      end: 240,
      refName: 'ctgA',
      assemblyName: 'volvox',
    })

    const event = new KeyboardEvent('keydown', {
      code: 'KeyM',
      shiftKey: true,
      ctrlKey: true,
    })

    document.dispatchEvent(event)

    await waitFor(() =>
      expect(
        view.getSelectedRegions(view.leftOffset, view.rightOffset)[0].key,
      ).toEqual('{volvox}ctgA:201..240-0'),
    )
  }, 40000)
})

describe('Create a label for a bookmark', () => {
  test('with a single click on the data grid', async () => {
    const { session, findByText, findAllByRole } = await createView()

    fireEvent.click(await findByText('Tools'))
    fireEvent.click(await findByText('Bookmarks'))

    // @ts-expect-error
    const { widgets } = session
    const bookmarkWidget = widgets.get('GridBookmark')
    bookmarkWidget.addBookmark({
      start: 200,
      end: 240,
      refName: 'ctgA',
      assemblyName: 'volvox',
    })

    const field = (await findAllByRole('cell'))[2]
    fireEvent.click(field)
    await userEvent.type(field, 'new label')
    // get the focus away from the field
    fireEvent.click(document)

    expect(field.innerHTML).toContain('new label')
  })
  test('with a double click via the dialog', async () => {
    const { session, findByText, findAllByRole, findByTestId } =
      await createView()

    fireEvent.click(await findByText('Tools'))
    fireEvent.click(await findByText('Bookmarks'))

    // @ts-expect-error
    const { widgets } = session
    const bookmarkWidget = widgets.get('GridBookmark')
    bookmarkWidget.addBookmark({
      start: 200,
      end: 240,
      refName: 'ctgA',
      assemblyName: 'volvox',
    })

    const field = (await findAllByRole('cell'))[2]

    fireEvent.doubleClick(field)
    const inputField = await findByTestId('edit-bookmark-label-field')
    await userEvent.type(inputField, 'new label')
    fireEvent.click(await findByText('Confirm'))
    expect(field.innerHTML).toContain('new label')
  })
})

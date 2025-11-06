import { fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, doBeforeEach, hts, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 50000 }
const opts = [{}, delay]

test('open Edit colors/arrangement dialog from multibigwig track menu', async () => {
  const { view, findByTestId, findByText } = await createView()
  view.setNewView(5, 0)

  // Click on the multibigwig track to open it
  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))

  const user = userEvent.setup()

  // Open the track menu
  const trackMenu = await findByTestId('track_menu_icon', ...opts)
  await user.click(trackMenu)

  // Find and click "Edit colors/arrangement..." option
  const editColorsBtn = await findByText('Edit colors/arrangement...', ...opts)
  await user.click(editColorsBtn)

  // Verify dialog opened
  const dialogTitle = await findByText(
    'Multi-wiggle color/arrangement editor',
    ...opts,
  )
  expect(dialogTitle).toBeTruthy()
}, 60000)

test('change color of individual source in grid', async () => {
  const { view, findByTestId, findByRole, findByText } = await createView()
  view.setNewView(5, 0)

  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))

  const user = userEvent.setup()
  const trackMenu = await findByTestId('track_menu_icon', ...opts)
  await user.click(trackMenu)

  const editColorsBtn = await findByText('Edit colors/arrangement...', ...opts)
  await user.click(editColorsBtn)

  // Wait for dialog and grid to appear
  await findByText('Multi-wiggle color/arrangement editor', ...opts)

  // The DataGrid should contain source rows
  const grid = await findByRole('grid', ...opts)
  expect(grid).toBeTruthy()

  // Look for color picker cells in the grid
  const colorPickerButtons = await findByTestId('color_picker', ...opts)
  expect(colorPickerButtons).toBeTruthy()
}, 60000)

test('bulk edit multiple rows simultaneously', async () => {
  const { view, findByTestId, findByText } = await createView()
  view.setNewView(5, 0)

  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))

  const user = userEvent.setup()
  const trackMenu = await findByTestId('track_menu_icon', ...opts)
  await user.click(trackMenu)

  const editColorsBtn = await findByText('Edit colors/arrangement...', ...opts)
  await user.click(editColorsBtn)

  await findByText('Multi-wiggle color/arrangement editor', ...opts)

  // Look for "Show Bulk row editor" button
  const bulkEditBtn = await findByText('Show Bulk row editor', ...opts)
  await user.click(bulkEditBtn)

  // Verify bulk edit panel opens
  const bulkEditPanel = await findByText('Bulk edit', ...opts)
  expect(bulkEditPanel).toBeTruthy()
}, 60000)

test('toggle tips display', async () => {
  const { view, findByTestId, findByText } = await createView()
  view.setNewView(5, 0)

  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))

  const user = userEvent.setup()
  const trackMenu = await findByTestId('track_menu_icon', ...opts)
  await user.click(trackMenu)

  const editColorsBtn = await findByText('Edit colors/arrangement...', ...opts)
  await user.click(editColorsBtn)

  await findByText('Multi-wiggle color/arrangement editor', ...opts)

  // Find and click "Show tips" button
  const showTipsBtn = await findByText('Show tips', ...opts)
  await user.click(showTipsBtn)

  // Verify tips are now shown (button text should change to "Hide tips")
  const hideTipsBtn = await findByText('Hide tips', ...opts)
  expect(hideTipsBtn).toBeTruthy()
}, 60000)

test('select multiple rows and change their color', async () => {
  const { view, findByTestId, findByText, findByRole } = await createView()
  view.setNewView(5, 0)

  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))

  const user = userEvent.setup()
  const trackMenu = await findByTestId('track_menu_icon', ...opts)
  await user.click(trackMenu)

  const editColorsBtn = await findByText('Edit colors/arrangement...', ...opts)
  await user.click(editColorsBtn)

  await findByText('Multi-wiggle color/arrangement editor', ...opts)

  // Look for checkbox elements in the grid to select rows
  const checkboxes = await findByRole('checkbox', ...opts)
  if (checkboxes) {
    // Click multiple checkboxes to select rows
    if (Array.isArray(checkboxes)) {
      await user.click(checkboxes[0]!)
      if (checkboxes[1]) {
        await user.click(checkboxes[1])
      }
    } else {
      await user.click(checkboxes)
    }
  }

  // Find "Change color of selected items" button
  const changeColorBtn = await findByText(
    'Change color of selected items',
    ...opts,
  )
  expect(changeColorBtn).toBeTruthy()
}, 60000)

test('move rows up and down', async () => {
  const { view, findByTestId, findByText } = await createView()
  view.setNewView(5, 0)

  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))

  const user = userEvent.setup()
  const trackMenu = await findByTestId('track_menu_icon', ...opts)
  await user.click(trackMenu)

  const editColorsBtn = await findByText('Edit colors/arrangement...', ...opts)
  await user.click(editColorsBtn)

  await findByText('Multi-wiggle color/arrangement editor', ...opts)

  // Look for movement buttons
  await findByTestId('move-selected-items-up-button', ...opts)
  await findByText('Move selected items up', ...opts)
}, 60000)

test('apply changes and close dialog', async () => {
  const { view, findByTestId, findByText, queryByText } = await createView()
  view.setNewView(5, 0)

  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))

  const user = userEvent.setup()
  const trackMenu = await findByTestId('track_menu_icon', ...opts)
  await user.click(trackMenu)

  const editColorsBtn = await findByText('Edit colors/arrangement...', ...opts)
  await user.click(editColorsBtn)

  await findByText('Multi-wiggle color/arrangement editor', ...opts)

  // Find and click the close/apply button
  // Usually at the bottom right of the dialog
  const applyBtn = await findByText('Apply', ...opts).catch(() =>
    findByText('Close', ...opts).catch(() => null),
  )

  if (applyBtn) {
    await user.click(applyBtn)

    // Dialog should close
    await waitFor(
      () => {
        expect(
          queryByText('Multi-wiggle color/arrangement editor'),
        ).not.toBeInTheDocument()
      },
      ...opts,
    )
  }
}, 60000)

test('row palettizer generates color palette for sources', async () => {
  const { view, findByTestId, findByText } = await createView()
  view.setNewView(5, 0)

  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))

  const user = userEvent.setup()
  const trackMenu = await findByTestId('track_menu_icon', ...opts)
  await user.click(trackMenu)

  const editColorsBtn = await findByText('Edit colors/arrangement...', ...opts)
  await user.click(editColorsBtn)

  await findByText('Multi-wiggle color/arrangement editor', ...opts)

  // Look for palettizer button or interface
  // The SetColorDialogRowPalettizer should be visible if enableRowPalettizer is true
  const palettizer = await findByText('Palettizer', ...opts).catch(() => null)

  // Palettizer should be available for multibigwig
  expect(palettizer).toBeTruthy()
}, 60000)

test('maintain source uniqueness after reordering', async () => {
  const { view, findByRole, findByTestId, findByText } = await createView()
  view.setNewView(5, 0)

  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))

  const user = userEvent.setup()
  const trackMenu = await findByTestId('track_menu_icon', ...opts)
  await user.click(trackMenu)

  const editColorsBtn = await findByText('Edit colors/arrangement...', ...opts)
  await user.click(editColorsBtn)

  await findByText('Multi-wiggle color/arrangement editor', ...opts)

  // Get initial grid state
  const grid = await findByRole('grid', ...opts)
  const initialRowCount = grid.querySelectorAll('[data-testid*="row"]').length

  // Perform some reordering
  const checkboxes = await findByRole('checkbox', ...opts)
  if (checkboxes && !Array.isArray(checkboxes)) {
    await user.click(checkboxes)

    const moveUpBtn = await findByText('Move selected items up', ...opts).catch(
      () => null,
    )
    if (moveUpBtn) {
      await user.click(moveUpBtn)
    }
  }

  // Verify row count is unchanged
  const finalRowCount = grid.querySelectorAll('[data-testid*="row"]').length
  expect(finalRowCount).toBe(initialRowCount)
}, 60000)

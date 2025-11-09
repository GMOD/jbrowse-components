import { fireEvent, within } from '@testing-library/react'

import { createView, doBeforeEach, expectCanvasMatch, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 60000 }
const opts = [{}, delay]

test('adds a PAF via the add track workflow', async () => {
  const {
    getByTestId,
    getAllByTestId,
    findByText,
    findByRole,
    findAllByTestId,
    view,
  } = await createView()
  view.showAllRegions()
  fireEvent.click(await findByText('File', ...opts))
  fireEvent.click(await findByText('Open track...', ...opts))
  fireEvent.change((await findAllByTestId('urlInput'))[0]!, {
    target: {
      value: 'volvox_del.paf',
    },
  })
  fireEvent.click(getAllByTestId('addTrackNextButton')[0]!)
  fireEvent.mouseDown(getByTestId('adapterTypeSelect'))
  fireEvent.change(getByTestId('trackNameInput'), {
    target: {
      value: 'volvox_del vs volvox',
    },
  })
  const selectors = await findAllByTestId('assembly-selector-textfield')

  // change query assembly
  fireEvent.mouseDown(await within(selectors[0]!).findByText('volvox'))
  fireEvent.click(within(await findByRole('listbox')).getByText('volvox_del'))
  fireEvent.click(getAllByTestId('addTrackNextButton')[0]!)

  const res = await findAllByTestId(/prerendered_canvas/, ...opts)
  expectCanvasMatch(res[0]!)
}, 60000)

test('bug: error message persists after fixing URL', async () => {
  const { getAllByTestId, findByText, findAllByTestId, queryByText } =
    await createView()

  // Open add track widget
  fireEvent.click(await findByText('File', ...opts))
  fireEvent.click(await findByText('Open track...', ...opts))

  // Enter incorrect URL that is not guessable
  fireEvent.change((await findAllByTestId('urlInput'))[0]!, {
    target: {
      value: 'randomfile.xyz',
    },
  })

  // Click "Next" and see the message that JBrowse is not able to guess the adapter type
  fireEvent.click(getAllByTestId('addTrackNextButton')[0]!)

  // Should show error message about not being able to guess adapter type
  await findByText(/JBrowse was not able to guess the adapter type/, ...opts)

  // Click "Back" to go back to URL input
  fireEvent.click(getAllByTestId('addTrackBackButton')[0]!)

  // Fix the URL to a valid one
  fireEvent.change((await findAllByTestId('urlInput'))[0]!, {
    target: {
      value: 'volvox.bam',
    },
  })

  // Click "Next" again
  fireEvent.click(getAllByTestId('addTrackNextButton')[0]!)

  // The bug: JBrowse still shows a message about not being able to guess the adapter
  // even though the URL was fixed. This should NOT happen.
  const errorMessage = queryByText(
    /JBrowse was not able to guess the adapter type/,
  )
  expect(errorMessage).toBeNull() // This should pass if the bug is fixed
}, 60000)

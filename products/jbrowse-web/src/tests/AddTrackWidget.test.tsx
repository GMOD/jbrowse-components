import { fireEvent, within } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  setup,
} from './util.tsx'

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

  const displays = await findAllByTestId(/^display-.*-done$/, ...opts)
  expectCanvasMatch(findCanvasIn(displays[0]!))
}, 60000)

test('bug: error message persists after fixing URL', async () => {
  const {
    getAllByTestId,
    findByText,
    findByTestId,
    findAllByTestId,
    queryByText,
  } = await createView()

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

  // volvox.bam has a guessable adapter, so the form advances to the confirm
  // step (trackNameInput). The bug was that the "not able to guess" message
  // lingered from the previous URL; assert it is gone once we've advanced.
  await findByTestId('trackNameInput', ...opts)
  expect(
    queryByText(/JBrowse was not able to guess the adapter type/),
  ).toBeNull()
}, 60000)

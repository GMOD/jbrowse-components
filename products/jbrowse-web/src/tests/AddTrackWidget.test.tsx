import { fireEvent, within } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findAnyDisplayPainted,
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
  const { getByTestId, findByText, findByRole, findAllByTestId, view } =
    await createView()
  view.showAllRegions()
  fireEvent.click(await findByText('File', ...opts))
  fireEvent.click(await findByText('Open track...', ...opts))
  fireEvent.change((await findAllByTestId('urlInput'))[0]!, {
    target: {
      value: 'volvox_del.paf',
    },
  })
  fireEvent.change(getByTestId('trackNameInput'), {
    target: {
      value: 'volvox_del vs volvox',
    },
  })
  fireEvent.mouseDown(
    await findByRole('combobox', { name: 'Query assembly', hidden: true }),
  )
  fireEvent.click(within(await findByRole('listbox')).getByText('volvox_del'))
  fireEvent.mouseDown(
    await findByRole('combobox', { name: 'Target assembly', hidden: true }),
  )
  fireEvent.click(within(await findByRole('listbox')).getByText('volvox'))
  fireEvent.click(getByTestId('addTrackButton'))

  const display = await findAnyDisplayPainted(delay)
  expectCanvasMatch(findCanvasIn(display))
}, 60000)

test('bug: error message persists after fixing URL', async () => {
  const { findByText, findByTestId, findAllByTestId, queryByText } =
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

  await findByText(/format could not be guessed/, ...opts)

  // Fix the URL to a valid one
  fireEvent.change((await findAllByTestId('urlInput'))[0]!, {
    target: {
      value: 'volvox.bam',
    },
  })

  // volvox.bam has a guessable adapter, so the form shows its confirm fields
  // (trackNameInput). The bug was that the "could not be guessed" message
  // lingered from the previous URL.
  await findByTestId('trackNameInput', ...opts)
  expect(queryByText(/format could not be guessed/)).toBeNull()
}, 60000)

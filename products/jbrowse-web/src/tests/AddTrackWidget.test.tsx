import { fireEvent, within } from '@testing-library/react'

import { createView, doBeforeEach, expectCanvasMatch, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
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

import { fireEvent } from '@testing-library/react'

import { createView, doBeforeEach, expectCanvasMatch, hts, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('matrix', async () => {
  const { view, findByTestId, findByText } = await createView()
  await view.navToLocString('ctgA')
  fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))

  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(
    await findByText('Multi-sample variant display (matrix)', ...opts),
  )
  fireEvent.click(await findByText('Force load', ...opts))
  expectCanvasMatch(await findByTestId(/prerendered_canvas/, ...opts))
}, 40000)

test('mphased', async () => {
  const { view, findByTestId, findByText } = await createView()
  await view.navToLocString('ctgA')
  fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))

  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(
    await findByText('Multi-sample variant display (matrix)', ...opts),
  )

  // Using the track menu twice not working currently, manually poke this setting
  view.tracks[0].displays[0].setPhasedMode('phased')

  fireEvent.click(await findByText('Force load', ...opts))
  expectCanvasMatch(await findByTestId(/prerendered_canvas/, ...opts))
}, 40000)

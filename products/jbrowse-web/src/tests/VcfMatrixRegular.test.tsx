import { fireEvent } from '@testing-library/react'

import { createView, doBeforeEach, expectCanvasMatch, hts, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('regular', async () => {
  const { view, findByTestId, findByText, findAllByTestId } = await createView()

  await view.navToLocString('ctgA')
  fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))

  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(
    await findByText('Multi-sample variant display (regular)', ...opts),
  )
  await new Promise(res => setTimeout(res, 1000))
  fireEvent.click(await findByText('Force load', ...opts))

  expectCanvasMatch((await findAllByTestId(/prerendered_canvas/, ...opts))[0]!)
}, 40000)

test('rphased', async () => {
  const { view, findByTestId, findByText, findAllByTestId } = await createView()

  await view.navToLocString('ctgA')
  fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))

  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(
    await findByText('Multi-sample variant display (regular)', ...opts),
  )

  // Using the track menu twice not working currently, manually poke this setting
  view.tracks[0].displays[0].setPhasedMode('phased')

  fireEvent.click(await findByText('Force load', ...opts))
  expectCanvasMatch((await findAllByTestId(/prerendered_canvas/, ...opts))[0]!)
}, 40000)

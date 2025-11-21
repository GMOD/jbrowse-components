import { fireEvent } from '@testing-library/react'
import { beforeEach, test } from 'vitest'

import { createView, doBeforeEach, expectCanvasMatch, hts, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 60000 }
const opts = [{}, delay]

test('regular', async () => {
  const { view, findByTestId, findAllByText, findByText, findAllByTestId } =
    await createView()

  await view.navToLocString('ctgA')
  fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))

  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(
    await findByText('Multi-sample variant display (regular)', ...opts),
  )
  await new Promise(res => setTimeout(res, 1000))
  fireEvent.click((await findAllByText('Force load', ...opts))[0]!)

  expectCanvasMatch((await findAllByTestId(/prerendered_canvas/, ...opts))[0]!)
}, 60000)

test('rphased', async () => {
  const { view, findByTestId, findAllByText, findByText, findAllByTestId } =
    await createView()

  await view.navToLocString('ctgA')
  fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))

  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(
    await findByText('Multi-sample variant display (regular)', ...opts),
  )

  await new Promise(res => setTimeout(res, 1000))
  // Using the track menu twice not working currently, manually poke this setting
  view.tracks[0].displays[0].setPhasedMode('phased')

  await new Promise(res => setTimeout(res, 1000))
  fireEvent.click((await findAllByText('Force load', ...opts))[0]!)
  expectCanvasMatch((await findAllByTestId(/prerendered_canvas/, ...opts))[0]!)
}, 60000)

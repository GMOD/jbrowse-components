import { fireEvent } from '@testing-library/react'

import { createView, expectCanvasMatch, hts } from './util'

export async function testMultiVariantDisplay({
  displayType,
  phasedMode,
  timeout = 60000,
}: {
  displayType: 'matrix' | 'regular'
  phasedMode?: 'phased'
  timeout?: number
}) {
  const delay = { timeout }
  const opts = [{}, delay] as const
  const displayText =
    displayType === 'matrix'
      ? 'Multi-sample variant display (matrix)'
      : 'Multi-sample variant display (regular)'
  const useAll = displayType === 'regular'

  const { view, findByTestId, findAllByText, findByText, findAllByTestId } =
    await createView()
  await view.navToLocString('ctgA')
  fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))

  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(await findByText(displayText, ...opts))

  if (useAll) {
    await new Promise(res => setTimeout(res, 1000))
  }

  if (phasedMode) {
    if (useAll) {
      await new Promise(res => setTimeout(res, 1000))
    }
    view.tracks[0].displays[0].setPhasedMode('phased')
  }

  if (useAll) {
    fireEvent.click((await findAllByText('Force load', ...opts))[0]!)
    expectCanvasMatch(
      (await findAllByTestId(/prerendered_canvas/, ...opts))[0]!,
    )
  } else {
    fireEvent.click(await findByText('Force load', ...opts))
    expectCanvasMatch(await findByTestId(/prerendered_canvas/, ...opts))
  }
}

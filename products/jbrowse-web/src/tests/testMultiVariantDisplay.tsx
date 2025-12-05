import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, expectCanvasMatch, openTrackMenu, sleep } from './util'

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

  const user = userEvent.setup()
  const { view, findAllByText, findByText, findAllByTestId, findByTestId } =
    await createView()
  await view.navToLocString('ctgA')
  await openTrackMenu(user, 'volvox_test_vcf', timeout)

  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(await findByText(displayText, ...opts))

  if (useAll) {
    await sleep(1000)
  }

  if (phasedMode) {
    if (useAll) {
      await sleep(1000)
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

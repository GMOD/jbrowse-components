import { fireEvent, waitFor } from '@testing-library/react'

import { createView, expectCanvasMatch, findCanvasIn, hts } from './util.tsx'

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

  const { view, findByTestId, findByText } = await createView()
  await view.navToLocString('ctgA')
  fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))

  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(await findByText(displayText, ...opts))

  if (phasedMode) {
    fireEvent.click(await findByTestId('track_menu_icon', ...opts))
    fireEvent.click(await findByText('Rendering mode', ...opts))
    fireEvent.click(await findByText(/^Phased/, ...opts))
  }

  const display = await findByTestId('variant-display-done', ...opts)
  await waitFor(() => {
    findCanvasIn(display)
  }, delay)
  expectCanvasMatch(findCanvasIn(display))
}

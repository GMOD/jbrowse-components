import { fireEvent } from '@testing-library/react'

import { createView, expectCanvasMatch, hts } from './util.tsx'

export async function testLinearMultiSampleVariantDisplay({
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
  const doneTestId =
    displayType === 'matrix'
      ? 'variant-matrix-display-done'
      : 'variant-display-done'
  const canvasTestId =
    displayType === 'matrix' ? 'variant_matrix_canvas' : 'variant_canvas'

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

  await findByTestId(doneTestId, ...opts)
  expectCanvasMatch(await findByTestId(canvasTestId, ...opts))
}

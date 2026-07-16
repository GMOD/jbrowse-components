import { fireEvent } from '@testing-library/react'

import { createView, expectCanvasMatch, hts } from './util.tsx'

import type { Results } from './util.tsx'

type DisplayType = 'matrix' | 'regular'

export const multiSampleVariantDisplayInfo = {
  matrix: {
    displayText: 'Multi-sample variant display (matrix)',
    doneTestId: 'variant-matrix-display-done',
    canvasTestId: 'variant_matrix_canvas',
  },
  regular: {
    displayText: 'Multi-sample variant display (regular)',
    doneTestId: 'variant-display-done',
    canvasTestId: 'variant_canvas',
  },
} as const

/**
 * Open the volvox multi-sample VCF track and switch it to the given display
 * type (without waiting for render). Returns the render result plus the
 * display-type ids so callers can wait for completion however they need.
 */
export async function openMultiSampleVariantDisplay({
  displayType,
  timeout = 60000,
}: {
  displayType: DisplayType
  timeout?: number
}): Promise<
  Results & { info: (typeof multiSampleVariantDisplayInfo)[DisplayType] }
> {
  const opts = [{}, { timeout }] as const
  const info = multiSampleVariantDisplayInfo[displayType]

  const result = await createView()
  const { view, findByTestId, findByText } = result
  await view.navToLocString('ctgA')
  fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))

  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(await findByText(info.displayText, ...opts))

  return { ...result, info }
}

export async function testLinearMultiSampleVariantDisplay({
  displayType,
  phasedMode,
  timeout = 60000,
}: {
  displayType: DisplayType
  phasedMode?: 'phased'
  timeout?: number
}) {
  const opts = [{}, { timeout }] as const
  const { findByTestId, findByText, info } =
    await openMultiSampleVariantDisplay({ displayType, timeout })

  if (phasedMode) {
    fireEvent.click(await findByTestId('track_menu_icon', ...opts))
    fireEvent.click(await findByText('Rendering mode', ...opts))
    fireEvent.click(await findByText(/^Phased/, ...opts))
  }

  await findByTestId(info.doneTestId, ...opts)
  expectCanvasMatch(await findByTestId(info.canvasTestId, ...opts))
}

import { fireEvent } from '@testing-library/react'

import {
  createView,
  expectCanvasMatch,
  findDisplayPainted,
  hts,
  volvoxConfigWithTracks,
} from './util.tsx'

import type { Results } from './util.tsx'
import type {
  LinearMultiSampleVariantDisplayModel,
  LinearMultiSampleVariantMatrixDisplayModel,
} from '@jbrowse/plugin-variants'

type MultiSampleVariantDisplayModel =
  | LinearMultiSampleVariantDisplayModel
  | LinearMultiSampleVariantMatrixDisplayModel

type DisplayType = 'matrix' | 'regular'

export const multiSampleVariantDisplayInfo = {
  matrix: {
    displayText: 'Multi-sample variant display (matrix)',
    displayTestId: 'variant-matrix-display',
    canvasTestId: 'variant_matrix_canvas',
  },
  regular: {
    displayText: 'Multi-sample variant display (regular)',
    displayTestId: 'variant-display',
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

  const result = await createView(volvoxConfigWithTracks(['volvox_test_vcf']))
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
  const { view, findByTestId, findByText, info } =
    await openMultiSampleVariantDisplay({ displayType, timeout })

  if (phasedMode) {
    fireEvent.click(await findByTestId('track_menu_icon', ...opts))
    fireEvent.click(await findByText('Rendering mode', ...opts))
    // The row is disabled, and its label carries a "(checking for phased
    // variants...)" suffix, until the background scan reports whether the data
    // has phased genotypes. A `/^Phased/` match took that disabled row, and a
    // click on a disabled MUI item is a no-op, so both phased cases silently
    // captured allele-count mode. The bare label only exists once the row is
    // enabled, so matching it exactly waits for the scan.
    fireEvent.click(await findByText('Phased', ...opts))
    const display: MultiSampleVariantDisplayModel = view.tracks[0].displays[0]
    expect(display.renderingMode).toBe('phased')
  }

  await findDisplayPainted(info.displayTestId, { timeout })
  expectCanvasMatch(await findByTestId(info.canvasTestId, ...opts))
}

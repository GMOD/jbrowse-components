import { render, screen } from '@testing-library/react'

import VariantDisplayComponent from '../LinearMultiSampleVariantDisplay/components/VariantDisplayComponent.tsx'
import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'
import VariantMatrixDisplayComponent from '../LinearMultiSampleVariantMatrixDisplay/components/VariantMatrixDisplayComponent.tsx'
import { createTestEnvironment as createMatrixTestEnvironment } from '../LinearMultiSampleVariantMatrixDisplay/testEnv.ts'

// `useVirtualScrollWheel` is bound to a panel rather than to the `<canvas>`,
// and says why: a canvas holds no DOM children, so everything a row display
// draws beside its cells is a sibling and a wheel over one of those never
// reaches a canvas-bound listener. Both variant displays bound it to the canvas
// with `TreeSidebar` outside, so a wheel over the dendrogram panned the view
// while the same gesture over MAF's scrolled its rows.
//
// What this pins is the mount point: the canvas AND the sidebar's inline layer
// (its resize handle, which is the half deliberately left un-portaled) are in
// the one element the listener is bound to.
const SOURCES = [{ name: 'S0' }, { name: 'S1' }]

interface Clusterable {
  setSources(s: { name: string }[]): void
  setLayoutAndClusterTree(l: { name: string }[], t: string): void
}

function clustered<T extends Clusterable>(display: T) {
  display.setSources(SOURCES)
  display.setLayoutAndClusterTree(SOURCES, '(S0,S1);')
  return display
}

test('the regular display binds the wheel to a panel holding the sidebar', () => {
  const { display } = createTestEnvironment().createDisplay()
  render(<VariantDisplayComponent model={clustered(display)} />)

  const panel = screen.getByTestId('variant-rows-panel')
  expect(panel.contains(screen.getByTestId('variant_canvas'))).toBe(true)
  expect(panel.querySelector('[data-gesture-owner]')).not.toBeNull()
})

test('the matrix display binds the wheel to a panel holding the sidebar', () => {
  const { display } = createMatrixTestEnvironment().createDisplay()
  render(<VariantMatrixDisplayComponent model={clustered(display)} />)

  const panel = screen.getByTestId('variant-matrix-rows-panel')
  expect(panel.contains(screen.getByTestId('variant_matrix_canvas'))).toBe(true)
  expect(panel.querySelector('[data-gesture-owner]')).not.toBeNull()
})

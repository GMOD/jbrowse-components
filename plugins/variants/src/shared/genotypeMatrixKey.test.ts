import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'
import { genotypeMatrixKey } from './genotypeMatrixKey.ts'

// The key `useFetch` serializes on every render of the cluster dialog. It was
// the MST display node, which stringifies to the whole snapshot — so it moved
// on writes that change nothing about the matrix, and carried a cohort's worth
// of `layout` while doing it.
function display() {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources([{ name: 'S0' }, { name: 'S1' }])
  return display
}

test('nothing to export before the sources land', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(genotypeMatrixKey(display)).toBeNull()
})

test('a sidebar resize or a scroll does not re-key the exported matrix', () => {
  const d = display()
  const before = JSON.stringify(genotypeMatrixKey(d))

  d.setTreeAreaWidth(120)
  d.setScrollTop(40)
  expect(JSON.stringify(genotypeMatrixKey(d))).toBe(before)
})

test('the arguments the matrix is built from do re-key it', () => {
  const d = display()
  const before = JSON.stringify(genotypeMatrixKey(d))

  d.setMafFilter(0.05)
  const withMaf = JSON.stringify(genotypeMatrixKey(d))
  expect(withMaf).not.toBe(before)

  d.setSubtreeFilter(['S0'])
  expect(JSON.stringify(genotypeMatrixKey(d))).not.toBe(withMaf)
})

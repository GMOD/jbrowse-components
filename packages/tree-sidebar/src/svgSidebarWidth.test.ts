import { BAND_LABEL_WIDTH } from './SvgBandLabels.tsx'
import { rowLabelsBoxWidth } from './rowLabelsBoxWidth.ts'
import { svgSidebarWidth } from './svgSidebarWidth.ts'

const sources = [{ name: 'a' }, { name: 'longer name' }]
const base = {
  showTree: false,
  hierarchy: undefined,
  sources,
  rowHeight: 20,
  treeAreaWidth: 80,
}

test('the labels alone reserve the widest label box', () => {
  expect(svgSidebarWidth(base)).toBe(rowLabelsBoxWidth(sources, 20))
})

test('hidden labels and no tree reserve nothing, whatever the inset', () => {
  expect(svgSidebarWidth({ ...base, showLabels: false, leftInset: 50 })).toBe(0)
})

test('the inset sits past the sidebar, and only when there is one', () => {
  const labels = rowLabelsBoxWidth(sources, 20)
  expect(svgSidebarWidth({ ...base, leftInset: 50 })).toBe(labels + 50)
})

test('a band strip adds its column ahead of the labels', () => {
  const bands = [{ key: 'x', label: 'x', start: 0, end: 2 }]
  expect(svgSidebarWidth({ ...base, bands })).toBe(
    rowLabelsBoxWidth(sources, 20) + BAND_LABEL_WIDTH,
  )
})

test('a tree that is showing takes its area width', () => {
  const hierarchy = { name: 'root', x: 0, y: 0, children: [] }
  expect(
    svgSidebarWidth({
      ...base,
      showTree: true,
      showLabels: false,
      hierarchy: hierarchy as never,
    }),
  ).toBe(80)
})

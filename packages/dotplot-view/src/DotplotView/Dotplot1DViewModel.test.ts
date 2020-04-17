import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import stateModelFactory from './Dotplot1DViewModel'

const { pluginManager } = createTestSession() as any
test('test', () => {
  const view = stateModelFactory(pluginManager).create({
    bpPerPx: 1,
    offsetPx: 1,
    displayedRegions: [
      { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
      { refName: 'ctgB', start: 0, end: 1000, assemblyName: 'volvox' },
    ],
  })
  expect(view.totalBp).toBe(2000)
  expect(view.dynamicBlocks).toMatchSnapshot()
  view.setBpPerPx(10)
  expect(view.dynamicBlocks).toMatchSnapshot()
})
test('moveTo', () => {
  const view = stateModelFactory(pluginManager).create({
    bpPerPx: 1,
    offsetPx: 1,
    displayedRegions: [
      { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
      { refName: 'ctgB', start: 0, end: 1000, assemblyName: 'volvox' },
    ],
  })
  const x1 = view.pxToBp(400)
  const x2 = view.pxToBp(600)
  expect(view.dynamicBlocks).toMatchSnapshot()
  view.moveTo(x1, x2)
  expect(view.dynamicBlocks).toMatchSnapshot()
})


import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import { types, getSnapshot } from 'mobx-state-tree'
import stateModelFactory, { Dotplot1DViewModel } from './Dotplot1DViewModel'

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
  console.log(x1.offset)
  console.log(x2.offset)
  expect(view.dynamicBlocks).toMatchSnapshot()
  view.moveTo(x1, x2)
  console.log(view.offsetPx)
  expect(view.dynamicBlocks).toMatchSnapshot()
})
// test('can instantiate a mostly empty model and read a default configuration value', () => {
//   const model = Session.create({
//     configuration: {},
//     jbrowse: {},
//   }).setView(
//     DotplotView.create({
//       type: 'DotplotView',
//       tracks: [{ name: 'foo track', type: 'PileupTrack' }],
//     }),
//   )

//   expect(model.tracks[0]).toBeTruthy()
//   expect(model.trackSelectorType).toBe('hierarchical')
// })

// test('can instantiate a model that lets you navigate', () => {
//   const session = Session.create({
//     configuration: {},
//     jbrowse: {},
//   })
//   const model = session.setView(
//     DotplotView.create({
//       id: 'test1',
//       type: 'DotplotView',
//       tracks: [{ name: 'foo track', type: 'PileupTrack' }],
//     }),
//   )
//   model.setDisplayedRegions([
//     { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
//   ])
//   expect(model.maxBpPerPx).toEqual(10)
//   model.setNewView(0.02, 0)

//   // test that it doesn't zoom in closer than 0.02
//   model.zoomTo(0.01)
//   expect(model.bpPerPx).toEqual(0.02) // clamped value

//   // test some sanity values from zooming around
//   model.setNewView(0.02, 0)
//   expect(model.pxToBp(10).offset).toEqual(0.2)
//   model.setNewView(0.1, 0)
//   expect(model.pxToBp(100).offset).toEqual(10)
//   model.setNewView(1, 0)
//   expect(model.pxToBp(100).offset).toEqual(100)
//   model.setNewView(10, 0)
//   expect(model.pxToBp(100).offset).toEqual(1000)

//   // model.horizontallyFlip()

//   // // this is actually the same in reverse mode, the offset is a representation of linear bp offset not actual bp
//   // model.setNewView(0.02, 0)
//   // expect(model.pxToBp(10).offset).toEqual(0.2)
//   // model.setNewView(0.1, 0)
//   // expect(model.pxToBp(100).offset).toEqual(10)
//   // model.setNewView(1, 0)
//   // expect(model.pxToBp(100).offset).toEqual(100)
//   // model.setNewView(10, 0)
//   // expect(model.pxToBp(100).offset).toEqual(1000)
// })

// test('can instantiate a model that has multiple displayed regions', () => {
//   const session = Session.create({
//     configuration: {},
//     jbrowse: {},
//   })
//   const model = session.setView(
//     DotplotView.create({
//       id: 'test2',
//       type: 'DotplotView',
//       tracks: [{ name: 'foo track', type: 'PileupTrack' }],
//     }),
//   )
//   model.setDisplayedRegions([
//     { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
//     { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgB' },
//   ])
//   expect(model.maxBpPerPx).toEqual(20)
//   model.setNewView(0.02, 0)

//   model.moveTo({ index: 0, offset: 100 }, { index: 0, offset: 200 })
//   expect(model.bpPerPx).toEqual(model.constrainBpPerPx(0.125))
//   model.moveTo({ index: 0, offset: 9950 }, { index: 1, offset: 50 })
//   expect(model.bpPerPx).toEqual(model.constrainBpPerPx(0.125))
//   model.moveTo({ index: 0, offset: 9000 }, { index: 1, offset: 1000 })
//   expect(model.bpPerPx).toEqual(model.constrainBpPerPx(2.5))
// })

// test('can instantiate a model that tests navTo/moveTo', async () => {
//   const session = Session.create({
//     jbrowse: {},
//     configuration: {},
//   })
//   const width = 800
//   const model = session.setView(
//     DotplotView.create({
//       id: 'test3',
//       type: 'DotplotView',
//       tracks: [{ name: 'foo track', type: 'PileupTrack' }],
//     }),
//   )
//   model.setWidth(width)
//   model.setDisplayedRegions([
//     { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
//     { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgB' },
//   ])
//   expect(model.maxBpPerPx).toEqual(20)

//   await model.navTo({ refName: 'ctgA', start: 0, end: 100 })
//   expect(model.bpPerPx).toEqual(model.constrainBpPerPx(100 / width))
//   await expect(
//     model.navTo({ refName: 'ctgA', start: 0, end: 20000 }),
//   ).rejects.toThrow(/could not find a region/)
//   expect(model.bpPerPx).toEqual(model.constrainBpPerPx(100 / width)) // did nothing
//   await model.navTo({ refName: 'ctgA' })
//   expect(model.offsetPx).toEqual(0)
//   expect(model.bpPerPx).toEqual(model.constrainBpPerPx(10000 / width))
//   await model.navTo({ refName: 'contigA', start: 0, end: 100 })
//   expect(model.bpPerPx).toEqual(model.constrainBpPerPx(100 / width))
// })

// test('can instantiate a model that >2 regions', () => {
//   const session = Session.create({
//     jbrowse: {},
//     configuration: {},
//   })
//   const width = 800
//   const model = session.setView(
//     DotplotView.create({
//       id: 'test4',
//       type: 'DotplotView',
//       tracks: [{ name: 'foo track', type: 'PileupTrack' }],
//     }),
//   )
//   model.setWidth(width)
//   model.setDisplayedRegions([
//     { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
//     { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgB' },
//     { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgC' },
//   ])
//   model.moveTo({ index: 0, offset: 100 }, { index: 2, offset: 100 })
//   expect(model.bpPerPx).toEqual(model.constrainBpPerPx(20000 / width))
//   model.setNewView(1, 0)

//   // extending in the minus gives us first displayed region
//   expect(model.pxToBp(-5000).refName).toEqual('ctgA')
//   expect(model.pxToBp(5000).refName).toEqual('ctgA')
//   expect(model.pxToBp(15000).refName).toEqual('ctgB')
//   expect(model.pxToBp(25000).refName).toEqual('ctgC')
//   // extending past gives us the last displayed region
//   expect(model.pxToBp(35000).refName).toEqual('ctgC')

//   model.setDisplayName('Volvox view')
//   expect(model.displayName).toBe('Volvox view')
//   model.moveTo(
//     { refName: 'ctgA', index: 0, offset: 0, start: 0, end: 10000 },
//     { refName: 'ctgC', index: 2, offset: 0, start: 0, end: 10000 },
//   )
//   expect(model.bpPerPx).toEqual(model.constrainBpPerPx(20000 / width))
//   model.moveTo(
//     { refName: 'ctgB', index: 1, offset: 0, start: 0, end: 10000 },
//     { refName: 'ctgC', index: 2, offset: 0, start: 0, end: 10000 },
//   )
//   expect(model.bpPerPx).toEqual(model.constrainBpPerPx(10000 / width))
//   expect(model.offsetPx).toEqual(10000 / model.bpPerPx)
//   expect(model.displayedRegionsTotalPx).toEqual(30000 / model.bpPerPx)
//   model.showAllRegions()
//   expect(model.bpPerPx).toEqual(model.constrainBpPerPx(30000 / width))
//   expect(model.offsetPx).toEqual(0)

//   expect(model.bpToPx({ refName: 'ctgA', coord: 100 })).toEqual({
//     index: 0,
//     offsetPx: 100 / model.bpPerPx,
//   })

//   expect(model.bpToPx({ refName: 'ctgB', coord: 100 })).toEqual({
//     index: 1,
//     offsetPx: 10100 / model.bpPerPx,
//   })
// })

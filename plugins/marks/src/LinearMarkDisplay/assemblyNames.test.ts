import { LINK_ELSEWHERE } from '@jbrowse/render-core/marks'

import { createTestEnvironment, features, workerResult } from './testEnv.ts'

function display() {
  return createTestEnvironment({ marks: [{ mark: 'rect' }] }, undefined, {
    extraAssemblyNames: ['hs1'],
    assemblyAliases: { vvx: 'volvox' },
  }).createDisplay().display
}

test('a display reads an assembly alias as the assembly it names, and another assembly as another', () => {
  const model = display()
  expect(model.sameAssemblyName('vvx', 'volvox')).toBe(true)
  expect(model.sameAssemblyName('hs1', 'volvox')).toBe(false)
})

test("a display places a link's far foot only on the track's assemblies, an alias of one included", () => {
  const model = display()
  expect(model.isTrackAssembly('vvx')).toBe(true)
  expect(model.isTrackAssembly('hs1')).toBe(false)
})

test("a pair whose two ends both have records draws once when another assembly's region is shown first", () => {
  const regions = [
    { refName: 'chr1', start: 0, end: 1000, assemblyName: 'hs1' },
    { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
    { refName: 'ctgB', start: 0, end: 1000, assemblyName: 'volvox' },
  ]
  const { display: model } = createTestEnvironment(
    {
      marks: [
        {
          mark: 'link',
          encoding: { x2: { refName: 'chrom2', pos: 'start2' } },
        },
      ],
    },
    regions,
    { extraAssemblyNames: ['hs1'] },
  ).createDisplay()
  const ends = [
    { refName: 'ctgA', start: 100, chrom2: 'ctgB', start2: 200 },
    { refName: 'ctgB', start: 200, chrom2: 'ctgA', start2: 100 },
  ]
  ends.forEach((end, i) => {
    model.setRpcData(
      i + 1,
      workerResult(model, features([{ ...end, end: end.start + 1 }])),
      regions[i + 1]!,
    )
  })
  expect(
    [1, 2].map(i => [...model.rpcDataMap.get(i)!.layers[0]!.x2Region!]),
  ).toEqual([[2], [LINK_ELSEWHERE]])
})

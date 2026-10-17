import { parseCigar2 } from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'
import { when } from 'mobx'

import { createDisplayWithSession } from './testEnv.ts'

const shapes = {
  same: '12000=',
  insertion: '6000=20000I6000=',
}

// one record per lane over the anchor's ctgA:0-12,000, in the order given,
// which densest-first keeps since every lane carries the same weight
function records(lanes: [string, keyof typeof shapes][]) {
  const features = lanes.map(
    ([lane]) =>
      new SimpleFeature({
        uniqueId: lane,
        refName: 'ctgA',
        start: 0,
        end: 12_000,
        strand: 1,
        mate: { assemblyName: lane, refName: 'c', start: 0, end: 32_000 },
      }),
  )
  const ops = new Map(
    lanes.map(([lane, shape]) => [
      lane,
      Uint32Array.from(parseCigar2(shapes[shape])),
    ]),
  )
  return { features, ops }
}

const region = (start: number, end: number) => ({
  assemblyName: 'volvox',
  refName: 'ctgA',
  start,
  end,
})

async function displayFor(
  type: string,
  anchorFetch: unknown = { features: [], ops: new Map() },
) {
  const { display } = createDisplayWithSession({
    syntenyAdapter: { type },
    trackAssemblyNames: ['volvox', 'l1', 'l2', 'l3', 'l4'],
    geneTracks: [],
    rpc: async (name, args) =>
      name === 'CoreGetInfo'
        ? { hasCoarseTier: false, anchorAssemblyName: 'volvox', lanes: [] }
        : name === 'MultiWayGetFeatures' &&
            (args.opts as { queryAssemblyName?: string } | undefined)
              ?.queryAssemblyName === undefined
          ? anchorFetch
          : [],
  })
  // a gene-block table declares no anchor, so it has no star to wait for
  const star = type !== 'MCScanBlocksAdapter'
  await when(
    () =>
      display.features !== undefined &&
      (!star || display.starAnchor !== undefined),
    { timeout: 5000 },
  )
  return display
}

function land(
  display: Awaited<ReturnType<typeof displayFor>>,
  lanes: [string, keyof typeof shapes][],
  start = 0,
  end = 12_000,
) {
  const { features, ops } = records(lanes)
  display.setFeatures(features, 'volvox', undefined, ops)
  display.holdLaneOrder([region(start, end)])
}

const interleaved: [string, keyof typeof shapes][] = [
  ['l1', 'insertion'],
  ['l2', 'same'],
  ['l3', 'insertion'],
  ['l4', 'same'],
]

test('graph haplotype lanes stack by structure, anchor-like first', async () => {
  const display = await displayFor('GbzBaseSyntenyAdapter')
  land(display, interleaved)
  expect(display.rowAssemblies).toEqual(['l2', 'l4', 'l1', 'l3'])
})

test('the anchor fetch landing stacks the lanes by structure', async () => {
  const display = await displayFor(
    'GbzBaseSyntenyAdapter',
    records(interleaved),
  )
  await when(() => display.rowAssemblies.length === 4, { timeout: 5000 })
  expect(display.rowAssemblies).toEqual(['l2', 'l4', 'l1', 'l3'])
})

test('a fetch on the same window keeps the order it was worked out with', async () => {
  const display = await displayFor('GbzBaseSyntenyAdapter')
  land(display, interleaved)
  land(
    display,
    [
      ['l1', 'same'],
      ['l2', 'insertion'],
      ['l3', 'same'],
      ['l4', 'insertion'],
    ],
    6000,
    18_000,
  )
  expect(display.rowAssemblies).toEqual(['l2', 'l4', 'l1', 'l3'])
})

test('a fetch off the window works the order out again', async () => {
  const display = await displayFor('GbzBaseSyntenyAdapter')
  land(display, interleaved)
  land(
    display,
    [
      ['l1', 'same'],
      ['l2', 'insertion'],
      ['l3', 'same'],
      ['l4', 'insertion'],
    ],
    50_000,
    62_000,
  )
  expect(display.rowAssemblies).toEqual(['l1', 'l3', 'l2', 'l4'])
})

test('a pinned order outranks the structure order', async () => {
  const display = await displayFor('GbzBaseSyntenyAdapter')
  land(display, interleaved)
  display.setDomain(['l3', 'l2'])
  expect(display.rowAssemblies.slice(0, 2)).toEqual(['l3', 'l2'])
})

test.each(['PairwiseIndexedPAFAdapter', 'MCScanBlocksAdapter'])(
  '%s keeps densest first',
  async type => {
    const display = await displayFor(type)
    land(display, interleaved)
    expect(display.heldLaneOrder).toBeUndefined()
    expect(display.rowAssemblies).toEqual(['l1', 'l2', 'l3', 'l4'])
  },
)

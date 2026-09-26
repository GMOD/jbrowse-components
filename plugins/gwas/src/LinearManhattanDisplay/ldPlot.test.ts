import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { NO_VALUE_ABGR } from '@jbrowse/core/util/markEncoding'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import {
  LD_COLOR,
  LD_INDEX_COLOR,
  LD_MARKS,
  LD_PALETTE,
  MANHATTAN_MARK,
} from './ldPlot.ts'
import { manhattanFixture } from './manhattanFixture.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'
import type { EncodedLayersResult } from '@jbrowse/core/util/markEncoding'

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 10_000,
  assemblyName: 'volvox',
}

function labels(items: MenuItem[]): string[] {
  return items.flatMap(i => [
    'label' in i && typeof i.label === 'string' ? i.label : '',
    ...('subMenu' in i ? labels(resolveSubMenu(i)) : []),
  ])
}

test('an unwritten plot is a point per feature at its score, which a snapshot leaves out', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(getSnapshot(display.conf.marks)).toEqual([MANHATTAN_MARK])
  expect(getSnapshot(display.conf)).not.toHaveProperty('marks')
  expect(display.markPlot.marks).toEqual([MANHATTAN_MARK])
  expect(display.layerRequests[0]?.encoding).toMatchObject({ y: 'score' })
  expect(display.gateEnabled).toBe(false)
})

test('the join runs where a mark names an LD field and the adapter has an LD file', () => {
  expect(createTestEnvironment().createDisplay().display.joinsLd).toBe(false)
  expect(
    createTestEnvironment({ marks: LD_MARKS }).createDisplay().display.joinsLd,
  ).toBe(true)
  expect(
    createTestEnvironment({
      marks: LD_MARKS,
      ldAdapter: false,
    }).createDisplay().display.joinsLd,
  ).toBe(false)
  const byRole = {
    mark: 'point',
    encoding: { y: 'score', shape: { field: 'ld_role' } },
  }
  expect(
    createTestEnvironment({ marks: [byRole] }).createDisplay().display.joinsLd,
  ).toBe(true)
})

// A plot restored with no index asks for no join, and the first load's top hit
// is what the join then reads r² to.
test('the index SNP is a fetch input only while the plot joins LD', () => {
  const plain = createTestEnvironment().createDisplay({
    displaySnapshot: { indexSnp: 'ctgA:101' },
  }).display
  expect(plain.rpcProps()).not.toHaveProperty('opts')

  const ld = createTestEnvironment({ marks: LD_MARKS }).createDisplay().display
  expect(ld.rpcProps()).not.toHaveProperty('opts')
  ld.setIndexSnp('ctgA:101')
  expect(ld.rpcProps().opts).toEqual({ ld: 'ctgA:101' })
})

test('LD colouring replaces any plot with the partners by r² and the index as a pink diamond over them, and returns to the default plot', () => {
  const { display } = createTestEnvironment({
    marks: [{ mark: 'bar', encoding: { y: 'score' } }],
  }).createDisplay()
  const transform = [{ type: 'filter', expr: "jexl:get(feature,'score') > 1" }]
  display.applyDisplaySettings({ transform })
  display.setLdColoring(true)
  expect(display.joinsLd).toBe(true)
  const [partners, index] = display.encodings
  expect(partners?.color).toMatchObject({
    field: 'ld',
    scale: 'threshold',
    domain: LD_COLOR.domain,
    range: LD_COLOR.range,
  })
  expect(index?.color).toBe(LD_INDEX_COLOR)
  expect(index?.shape).toMatchObject({
    field: 'ld_role',
    domain: ['index'],
    range: ['diamond'],
  })
  expect(display.layerRequests.map(r => r.transform)).toEqual([
    [{ type: 'filter', expr: "jexl:feature.ld_role != 'index'" }],
    [{ type: 'filter', expr: "jexl:feature.ld_role == 'index'" }],
  ])
  expect(display.markPlot.transform).toEqual(transform)

  display.setLdColoring(false)
  expect(display.joinsLd).toBe(false)
  expect(getSnapshot(display.conf)).not.toHaveProperty('marks')
  expect(display.markPlot.transform).toEqual(transform)
})

test('right-clicking a point colours by LD to it and pins it', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.colorByLdToHit({ refName: 'ctgA', start: 499 })
  expect(display.joinsLd).toBe(true)
  expect(display.indexSnp).toBe('ctgA:500')
  expect(display.indexSnpPinned).toBe(true)

  display.useTopHitAsIndex()
  expect(display.indexSnpPinned).toBe(false)
})

test('the LD menu is there only for a track with an LD file', () => {
  const withLd = createTestEnvironment().createDisplay().display
  expect(labels(withLd.trackMenuItems())).toEqual(
    expect.arrayContaining([
      'Edit plot...',
      'LD',
      'Color by LD to index SNP',
      'Set index SNP to top hit',
    ]),
  )
  const without = createTestEnvironment({ ldAdapter: false }).createDisplay()
    .display
  expect(labels(without.trackMenuItems())).not.toContain('LD')
})

function ldLoad({
  index,
  partners,
}: {
  index: boolean
  partners: number[]
}): EncodedLayersResult {
  return {
    layers: [
      manhattanFixture({
        x: partners.map((_, i) => 200 + i),
        y: partners.map(() => 3),
        color: partners,
        flatbush: false,
        scale: {
          kind: 'threshold',
          field: 'ld',
          domain: [0.2, 0.4, 0.6, 0.8],
          missing: true,
        },
      }),
      index
        ? manhattanFixture({
            x: [100],
            y: [5],
            flatbush: false,
            shapeScale: {
              kind: 'shape',
              field: 'ld_role',
              domain: ['index'],
              entries: [{ value: 'index', shape: 'diamond' }],
            },
          })
        : manhattanFixture({ x: [], y: [], flatbush: false }),
    ],
  }
}

// Without the notice an export where nothing matched the index SNP is an
// all-grey plot under a full r² key. An index no loaded region holds, as after
// pinning one and navigating to another contig, is not missing.
test('a missing index SNP is a notice naming why every other point is grey', () => {
  const { display } = createTestEnvironment({
    marks: LD_MARKS,
  }).createDisplay()
  display.setIndexSnp('ctgA:500')
  const r2 = cssColorToABGR(LD_PALETTE[4]!)
  display.setRpcData(1, ldLoad({ index: false, partners: [NO_VALUE_ABGR] }), {
    ...REGION,
    refName: 'ctgB',
  })
  expect(display.indexSnpMissing).toBe(false)
  display.setRpcData(
    0,
    ldLoad({ index: true, partners: [r2, NO_VALUE_ABGR] }),
    REGION,
  )
  expect(display.indexSnpMissing).toBe(false)
  display.setRpcData(
    0,
    ldLoad({ index: true, partners: [NO_VALUE_ABGR, NO_VALUE_ABGR] }),
    REGION,
  )
  expect(display.indexSnpMissing).toBe(true)
  expect(display.notices).toEqual([
    expect.stringMatching(/^No point has LD data to the index SNP/),
  ])
})

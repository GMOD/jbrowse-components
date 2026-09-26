import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { LD_COLOR, LD_MARK, LD_SHAPE, MANHATTAN_MARK } from './ldPlot.ts'
import { manhattanFixture } from './manhattanFixture.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'
import type { EncodedChannels } from '@jbrowse/core/util/markEncoding'

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
    createTestEnvironment({ marks: [LD_MARK] }).createDisplay().display.joinsLd,
  ).toBe(true)
  expect(
    createTestEnvironment({
      marks: [LD_MARK],
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

  const ld = createTestEnvironment({ marks: [LD_MARK] }).createDisplay().display
  expect(ld.rpcProps()).not.toHaveProperty('opts')
  ld.setIndexSnp('ctgA:101')
  expect(ld.rpcProps().opts).toEqual({ ld: 'ctgA:101' })
})

test('LD colouring writes the r² bins and the index diamond on every point mark, and back', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.setLdColoring(true)
  expect(display.joinsLd).toBe(true)
  const [encoding] = display.encodings
  expect(encoding?.color).toMatchObject({
    field: 'ld',
    scale: 'threshold',
    domain: LD_COLOR.domain,
    range: LD_COLOR.range,
  })
  expect(encoding?.shape).toMatchObject({
    field: 'ld_role',
    domain: LD_SHAPE.domain,
    range: LD_SHAPE.range,
  })

  display.setLdColoring(false)
  expect(display.joinsLd).toBe(false)
  expect(getSnapshot(display.conf)).not.toHaveProperty('marks')
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

// Without the notice an export where nothing matched the index SNP is an
// all-grey plot under a full r² key. An index no loaded region holds, as after
// pinning one and navigating to another contig, is not missing.
test('a missing index SNP is a notice naming why every other point is grey', () => {
  const { display } = createTestEnvironment({
    marks: [LD_MARK],
  }).createDisplay()
  display.setIndexSnp('ctgA:500')
  const roles = (values: string[]): { layers: EncodedChannels[] } => ({
    layers: [
      {
        ...manhattanFixture({ x: [100], y: [3], flatbush: false }),
        shapeScale: {
          kind: 'shape',
          field: 'ld_role',
          domain: ['index', 'partner'],
          entries: values.map(value => ({ value, shape: 'circle' as const })),
        },
      },
    ],
  })
  display.setRpcData(1, roles(['']), { ...REGION, refName: 'ctgB' })
  expect(display.indexSnpMissing).toBe(false)
  display.setRpcData(0, roles(['index', 'partner', '']), REGION)
  expect(display.indexSnpMissing).toBe(false)
  display.setRpcData(0, roles(['index', '']), REGION)
  expect(display.indexSnpMissing).toBe(true)
  expect(display.notices).toEqual([
    expect.stringMatching(/^No point has LD data to the index SNP/),
  ])
})

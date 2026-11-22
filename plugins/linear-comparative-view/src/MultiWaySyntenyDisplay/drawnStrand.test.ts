import { SimpleFeature } from '@jbrowse/core/util'

import { createDisplayWithSession } from './testEnv.ts'

import type { MultiWaySyntenyDisplayModel } from './model.ts'

const A = 'volvox'
const R = 'volvox_random'
const I = 'volvox_ins'

function record(
  id: string,
  lane: string,
  [start, end]: [number, number],
  [mateStart, mateEnd]: [number, number],
  strand: number,
  type?: string,
) {
  return new SimpleFeature({
    uniqueId: id,
    refName: 'ctgA',
    start,
    end,
    strand,
    assemblyName: A,
    ...(type ? { type } : {}),
    mate: {
      assemblyName: lane,
      refName: 'ctgB',
      start: mateStart,
      end: mateEnd,
    },
  })
}

// R reads reversed throughout and lacks 50 kb of the anchor between its third
// and fourth pieces. I is reversed but for its middle, and reads the stretch
// between its flanks as 20 kb replaced by 30 kb on its flanks' strand and as
// a 30 kb insertion on its middle's.
const features = [
  record('r1', R, [550_000, 600_000], [0, 50_000], -1),
  record('r2', R, [500_000, 550_000], [50_000, 100_000], -1),
  record('r3', R, [450_000, 500_000], [100_000, 150_000], -1),
  record('r4', R, [350_000, 400_000], [150_000, 200_000], -1),
  record('r5', R, [300_000, 350_000], [200_000, 250_000], -1),
  record('r6', R, [250_000, 300_000], [250_000, 300_000], -1),
  record('i1', I, [230_000, 240_000], [0, 10_000], -1),
  record('i2', I, [220_000, 230_000], [10_000, 20_000], -1),
  record('i3', I, [100_000, 150_000], [20_000, 70_000], 1),
  record('i4', I, [150_000, 200_000], [100_000, 150_000], 1),
  record('i5', I, [90_000, 100_000], [150_000, 160_000], -1),
  record('i6', I, [80_000, 90_000], [160_000, 170_000], -1),
]

async function drawn(held = features) {
  const { display } = createDisplayWithSession({
    trackAssemblyNames: [A, R, I],
    geneTracks: [],
    rpc: () => new Promise(() => {}),
  })
  display.lgv.setDisplayedRegions([
    { refName: 'ctgA', start: 0, end: 1_000_000, assemblyName: A },
  ])
  display.lgv.showAllRegions()
  display.setFeatures(held)
  for (let i = 0; i < 200 && display.laneDecisions.size < 2; i++) {
    await new Promise(r => setTimeout(r, 5))
  }
  return display
}

function frameOf(display: MultiWaySyntenyDisplayModel, lane: string) {
  return display.laneStack.lanes.find(l => l.assemblyName === lane)?.frame
}

test('a lane drawn reversed opens the holes and leads with the changes of the strand it is drawn on', async () => {
  const display = await drawn()
  expect([R, I].map(lane => display.laneDecisions.get(lane)?.flipped)).toEqual([
    true,
    true,
  ])
  expect(frameOf(display, R)?.openings).toEqual([{ at: 150_000, bp: 50_000 }])
  expect(
    display.laneHeaderRows.find(row => row.assemblyName === I)?.changes?.text,
  ).toBe('100 kb inversion, 20 kb replaced by 30 kb')
})

test('a frozen lane drawn reversed slides across its hole as far as the nudge', async () => {
  const display = await drawn()
  display.setLanesFrozen(true)
  const before = frameOf(display, R)!.min
  const bpPerPx =
    (display.laneDecisions.get(R)!.rung * display.visibleBpSpan) /
    display.canvasWidthPx
  display.nudgeLane(R, 100)
  expect(Math.abs(frameOf(display, R)!.min - before)).toBeCloseTo(100 * bpPerPx)
})

test('the ribbon key names the repeat color only while the track holds an array record', async () => {
  const labels = (display: MultiWaySyntenyDisplayModel) =>
    display.colorScales.flatMap(scale =>
      scale.kind === 'categorical' ? scale.entries.map(e => e.label) : [],
    )
  expect(labels(await drawn())).not.toContain('Repeat, copies not paired')
  expect(
    labels(
      await drawn([
        ...features,
        record('a', R, [600_000, 700_000], [300_000, 400_000], 1, 'array'),
      ]),
    ),
  ).toContain('Repeat, copies not paired')
})

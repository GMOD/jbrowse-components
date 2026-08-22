import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// The twin of dotplot's hover.integration.test.ts, for the invalidation axis
// nothing re-picks after: the ribbons moving under a stationary cursor. The
// pointer handlers on `LevelSyntenyCanvas` cover the pointer moving and nothing
// else, and a wheel over that same canvas scroll-zooms both rows while
// suppressing the hover handler for the duration.
//
// The hit is written by hand rather than picked. What is under test is the
// clear, not the pick — `syntenyPickEngine.test.ts` owns that — and a hand-made
// hit needs no committed geometry to address. `hoveredInstanceIdx` is the whole
// assertion surface for the same reason: the tooltip (`tooltipLines`) and the
// shader's outline (`renderParams.hoveredFeatureId`) are both pure derivations
// of it, so a stale index is a stale tooltip by construction.

const BP = 16000

const assembly = (name: string) => ({
  name,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}_refseq`,
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: `${name}-ctgA`,
          start: 0,
          end: BP,
          seq: 'a'.repeat(BP),
        },
      ],
    },
  },
})

async function setup() {
  const session = createTestSession() as any
  session.addAssemblyConf(assembly('volvox'))
  session.addAssemblyConf(assembly('volvox2'))
  const view = (await session.launchView('LinearSyntenyView', {
    init: { views: [{ assembly: 'volvox' }, { assembly: 'volvox2' }] },
  })) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(() => view.init === undefined)

  session.addSessionTrackConf({
    trackId: 'pafTrack',
    name: 'pafTrack',
    type: 'SyntenyTrack',
    assemblyNames: ['volvox', 'volvox2'],
    adapter: {
      type: 'PAFAdapter',
      pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
      assemblyNames: ['volvox', 'volvox2'],
    },
  })
  const level = view.levels[0]!
  level.showTrack('pafTrack')
  await when(() => level.linearSyntenyDisplays.length > 0)
  const display = level.linearSyntenyDisplays[0]!
  return { view, level, display }
}

function hover(
  level: { setHoveredFeature: (hit: any) => void },
  display: { displayKey: string },
) {
  level.setHoveredFeature({ key: display.displayKey, instanceIndex: 3 })
}

test('a hover set on the level lands on the display that owns the hit', async () => {
  const { level, display } = await setup()

  hover(level, display)
  expect(display.hoveredInstanceIdx).toBe(3)

  // a miss clears the band, which is the only clear the pointer handlers do
  level.setHoveredFeature(undefined)
  expect(display.hoveredInstanceIdx).toBe(-1)
}, 20000)

// A pan is the case that needs the reaction most: it moves every ribbon and,
// inside the fetch buffer, commits nothing — so `setRpcData`, the only other
// writer that clears the hover, never runs.
test('a pan of either row drops the hover', async () => {
  const { view, level, display } = await setup()

  hover(level, display)
  view.views[0]!.horizontalScroll(50)
  expect(display.hoveredInstanceIdx).toBe(-1)

  // the second row is its own axis; a hover held over a pan of it was the same
  // bug with one row's worth of coverage
  hover(level, display)
  view.views[1]!.horizontalScroll(50)
  expect(display.hoveredInstanceIdx).toBe(-1)
}, 20000)

// A zoom inside the current log2 bucket refetches nothing either, so the stored
// index survives on the same terms a pan leaves it on.
test('a zoom drops the hover', async () => {
  const { view, level, display } = await setup()

  hover(level, display)
  const row = view.views[0]!
  // in, not out: the rows open fit-to-width, which is already `maxBpPerPx`, and
  // `zoomTo` clamps there — a no-op moves no ribbon and should clear nothing
  row.zoomTo(row.bpPerPx / 2)
  expect(row.bpPerPx).toBeLessThan(BP / 800)
  expect(display.hoveredInstanceIdx).toBe(-1)
}, 20000)

// The band's own height slides every ribbon vertically while the cursor stays
// put, which is why it is one of `bandTransformKey`'s numbers. Dotplot's twin
// found the same axis by leaving `viewHeight` out of `plotTransform` first.
test('a band height change drops the hover', async () => {
  const { level, display } = await setup()

  hover(level, display)
  level.setHeight(level.height + 40)
  expect(display.hoveredInstanceIdx).toBe(-1)
}, 20000)

// The negative control, and the reason the transform is a key rather than the
// whole render state: a setting that repaints the band without moving a ribbon
// leaves the hover where the cursor still is.
test('a repaint that moves nothing keeps the hover', async () => {
  const { view, level, display } = await setup()

  hover(level, display)
  view.setDrawCurves(!view.drawCurves)
  expect(display.hoveredInstanceIdx).toBe(3)
}, 20000)

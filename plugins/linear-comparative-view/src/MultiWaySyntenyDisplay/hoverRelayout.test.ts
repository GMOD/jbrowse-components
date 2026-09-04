import { SimpleFeature } from '@jbrowse/core/util'
import { when } from 'mobx'

import { createDisplay } from './testEnv.ts'

import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type { Feature } from '@jbrowse/core/util'

// A group hover re-resolves through `groupTarget.get(key)` when the lanes are
// relaid out. A direct-link ribbon carries no group, so its raw `targetIdx` is
// the whole of what the highlight, the tooltip and the click have to go on —
// and the lanes relayout on four things no viewport clear can see: a reorder, a
// hidden lane, a pinned contig and a dependent fetch commit.
const MATES = ['volvox_random', 'volvox_other']
const LINK_PAIR = `${MATES[0]}|${MATES[1]}`

function orthologFeatures(name: string, start: number, end: number) {
  return MATES.map(
    assemblyName =>
      new SimpleFeature({
        uniqueId: `${name}-${assemblyName}`,
        name,
        refName: 'ctgA',
        start,
        end,
        strand: 1,
        mate: { assemblyName, refName: 'ctgB', start, end },
      }),
  )
}

function link(uniqueId: string, start: number, end: number) {
  return new SimpleFeature({
    uniqueId,
    refName: 'ctgB',
    start,
    end,
    strand: 1,
    mate: { refName: 'ctgB', start, end },
  })
}

/**
 * Three lanes, because the direct records only draw from the SECOND gutter
 * down. The wait is for the harness's own ortholog fetch to answer with nothing
 * — `afterAttach` reaches its installers through a dynamic import, and a commit
 * landing after these features were put in by hand would wipe them.
 */
async function stackedDisplay(links: Feature[]) {
  const display = createDisplay()
  await when(() => display.features !== undefined, { timeout: 5000 })
  display.setFeatures([
    ...orthologFeatures('g1', 100, 200),
    ...orthologFeatures('g2', 400, 500),
    ...orthologFeatures('g3', 700, 800),
  ])
  display.setLaneLinks(new Map([[LINK_PAIR, links]]), 'window-1')
  return display
}

function hoverDirectLink(display: MultiWaySyntenyDisplayModel) {
  const { targets } = display.ribbonGeometry
  const targetIdx = targets.findIndex(t => t.groupKey === undefined)
  const target = targets[targetIdx]!
  display.setHoverTarget({
    label: target.label,
    feature: target.feature,
    targetIdx,
  })
  return targetIdx
}

function viewportOf(display: MultiWaySyntenyDisplayModel) {
  const view = display.lgv
  return { offsetPx: view.offsetPx, bpPerPx: view.bpPerPx, height: view.height }
}

test('a lane-links commit drops a direct-link hover rather than moving it', async () => {
  const display = await stackedDisplay([
    link('L1', 110, 210),
    link('L2', 410, 510),
  ])
  const idx = hoverDirectLink(display)
  expect(display.hoverTarget?.feature.id()).toBe('L1')
  expect(display.hoverTarget?.groupKey).toBeUndefined()
  expect(display.hoveredFeatureId).toBe(idx + 1)

  const viewport = viewportOf(display)
  display.setLaneLinks(
    new Map([
      [
        LINK_PAIR,
        [link('L0', 10, 60), link('L1', 110, 210), link('L2', 410, 510)],
      ],
    ]),
    'window-2',
  )
  expect(viewportOf(display)).toEqual(viewport)
  // what the stored index would otherwise light up, name and open
  expect(display.ribbonGeometry.targets[idx]?.feature.id()).toBe('L0')

  expect(display.hoverTarget).toBeUndefined()
  expect(display.hoveredFeatureId).toBe(0)
})

// Move up / Move down / Hide lane carry `keepMenuOpen`, so they fire
// repeatedly with the pointer nowhere near the canvas they are relaying out.
test('a lane reorder drops the hover', async () => {
  const display = await stackedDisplay([link('L1', 110, 210)])
  hoverDirectLink(display)
  expect(display.hoverTarget).toBeDefined()

  const viewport = viewportOf(display)
  display.setRowOrder([MATES[1]!, MATES[0]!])
  expect(display.rowAssemblies).toEqual([MATES[1], MATES[0]])
  expect(viewportOf(display)).toEqual(viewport)
  expect(display.hoverTarget).toBeUndefined()
})

test('a hidden lane drops the hover', async () => {
  const display = await stackedDisplay([link('L1', 110, 210)])
  hoverDirectLink(display)
  expect(display.hoverTarget).toBeDefined()

  const viewport = viewportOf(display)
  display.setHiddenLanes([MATES[1]!])
  expect(viewportOf(display)).toEqual(viewport)
  expect(display.hoverTarget).toBeUndefined()
})

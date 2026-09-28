import { SimpleFeature } from '@jbrowse/core/util'
import { when } from 'mobx'

import { NO_OPS } from './alignmentOps.ts'
import { outlineKey } from './multiwayGeometry.ts'
import { createDisplay, heldSpecs } from './testEnv.ts'

import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type { Feature } from '@jbrowse/core/util'

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

// Three lanes, since direct records draw from the second gutter down.
async function stackedDisplay(links: Feature[]) {
  const display = createDisplay()
  // the harness's empty fetch would wipe features set before it lands
  await when(() => display.features !== undefined, { timeout: 5000 })
  display.setFeatures([
    ...orthologFeatures('g1', 100, 200),
    ...orthologFeatures('g2', 400, 500),
    ...orthologFeatures('g3', 700, 800),
  ])
  const held = new Map([[LINK_PAIR, { key: 'window-1', links, ops: NO_OPS }]])
  display.setLaneLinks(held, heldSpecs(held), display.anchorAssemblyName)
  return display
}

function hoverDirectLink(display: MultiWaySyntenyDisplayModel) {
  const target = display.ribbonGeometry.targets.find(
    t => t.linkId !== undefined,
  )!
  display.setHoverTarget(target)
  return target.linkId!
}

function linkFeatureId(display: MultiWaySyntenyDisplayModel, linkId: string) {
  return display.ribbonGeometry.linkTarget.get(linkId)! + 1
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
  hoverDirectLink(display)
  display.selectHovered()
  expect(display.hoverTarget?.feature.id()).toBe('L1')
  expect(display.hoverTarget?.groupKey).toBeUndefined()
  const before = linkFeatureId(display, 'L1')
  expect(display.hoveredFeatureId).toBe(before)

  const viewport = viewportOf(display)
  const held = new Map([
    [
      LINK_PAIR,
      {
        key: 'window-2',
        ops: NO_OPS,
        links: [link('L0', 10, 60), link('L1', 110, 210), link('L2', 410, 510)],
      },
    ],
  ])
  display.setLaneLinks(held, heldSpecs(held), display.anchorAssemblyName)
  expect(viewportOf(display)).toEqual(viewport)
  expect(display.hoverTarget).toBeUndefined()
  expect(display.hoveredFeatureId).toBe(0)

  expect(display.ribbonGeometry.targets[before - 1]?.feature.id()).toBe('L0')
  expect(display.clickedFeatureId).toBe(linkFeatureId(display, 'L1'))
  expect(display.clickedFeatureId).not.toBe(before)
})

test('a lane reorder drops the hover and keeps a direct-link click', async () => {
  const display = await stackedDisplay([link('L1', 110, 210)])
  hoverDirectLink(display)
  display.selectHovered()
  expect(display.clickedFeatureId).toBe(linkFeatureId(display, 'L1'))

  const viewport = viewportOf(display)
  display.setDomain([MATES[1]!, MATES[0]!])
  expect(display.rowAssemblies).toEqual([MATES[1], MATES[0]])
  expect(viewportOf(display)).toEqual(viewport)
  expect(display.hoverTarget).toBeUndefined()
  expect(display.clickedFeatureId).toBe(0)

  display.setDomain([MATES[0]!, MATES[1]!])
  expect(display.clickedFeatureId).toBe(linkFeatureId(display, 'L1'))
})

test('a hidden lane drops the hover', async () => {
  const display = await stackedDisplay([link('L1', 110, 210)])
  hoverDirectLink(display)
  expect(display.hoverTarget).toBeDefined()

  const viewport = viewportOf(display)
  display.hideLane(MATES[1]!)
  expect(viewportOf(display)).toEqual(viewport)
  expect(display.hoverTarget).toBeUndefined()
})

test('a lane-genes commit keeps a direct-link hover', async () => {
  const display = await stackedDisplay([link('L1', 110, 210)])
  hoverDirectLink(display)
  expect(display.hoverTarget).toBeDefined()

  display.setLaneGenes(
    new Map(),
    display.laneGenesFetchSpecs,
    display.anchorAssemblyName,
  )
  expect(display.hoverTarget).toBeDefined()
  expect(display.hoverTarget?.feature.id()).toBe('L1')
})

test('a click outlines the gutters and not the lane ticks', async () => {
  const display = await stackedDisplay([link('L1', 110, 210)])
  hoverDirectLink(display)
  display.selectHovered()
  expect(display.tickGeometry.layers.length).toBeGreaterThan(0)
  const outlines = [...display.renderLayers.values()]
    .filter(layer => layer.kind === 'outline')
    .map(layer => layer.key)
  expect(outlines).toEqual(
    [...display.ribbonGeometry.cells.keys()].map(outlineKey),
  )
})

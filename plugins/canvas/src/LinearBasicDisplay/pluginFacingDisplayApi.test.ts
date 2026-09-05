import { makeFlatbushItem } from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment, rightClick } from './testEnv.ts'

// The identifiers published plugins read off the display model; removals fail
// here, additions do not. To drop one deliberately, delete it in the same
// commit and say which published plugins you checked.
const PLUGIN_FACING = {
  contextMenuInfo: 'msaview, protein3d',
  fetchFullFeature: 'msaview, protein3d',
  isGeneLike: 'msaview',
}

const gene = makeFlatbushItem({
  featureId: 'EDEN',
  type: 'gene',
  name: 'EDEN',
  startBp: 1050,
  endBp: 9000,
})

test('the display keeps every member a published plugin reaches for', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()

  const missing = Object.entries(PLUGIN_FACING)
    .filter(([name]) => !(name in display))
    .map(([name, plugin]) => `${name} (${plugin})`)

  expect(missing).toEqual([])
})

test('contextMenuItems survives being called detached, the way a plugin wraps it', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  const superContextMenuItems = display.contextMenuItems

  expect(() => superContextMenuItems()).not.toThrow()
  rightClick(display, gene)
  expect(() => superContextMenuItems()).not.toThrow()
  expect(
    superContextMenuItems().map(i => ('label' in i ? i.label : undefined)),
  ).toContain('Collapse introns')
})

test('isGeneLike answers for the right-clicked feature', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()

  expect(display.isGeneLike).toBe(false)

  rightClick(display, gene)
  expect(display.isGeneLike).toBe(true)

  rightClick(
    display,
    makeFlatbushItem({
      featureId: 'match1',
      type: 'match',
      name: 'match1',
      startBp: 1050,
      endBp: 9000,
    }),
  )
  expect(display.isGeneLike).toBe(false)
})

import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { sharedKeysOf } from './pinDistinct.ts'
import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'

import type { MarkLegendSection } from './legend.ts'

// three values whose hashes land on one of the three shapes
const VARIANTS = features([
  { start: 0, end: 1, type: 'SNV', QUAL: 10 },
  { start: 10, end: 11, type: 'deletion', QUAL: 20 },
  { start: 20, end: 21, type: 'insertion', QUAL: 30 },
])

test('a shape key whose unlisted values share a shape is a shared key, and a listed pair is not', () => {
  const section = (domain: string[]): MarkLegendSection => ({
    markIndexes: [0],
    channel: 'shape',
    title: 'type',
    key: {},
    scale: {
      kind: 'shape',
      field: 'type',
      domain,
      entries: [
        { value: 'SNV', shape: 'triangle-down' },
        { value: 'deletion', shape: 'triangle-down' },
        { value: 'insertion', shape: 'circle' },
        { value: '', shape: 'circle' },
      ],
    },
  })
  expect(sharedKeysOf([section([])])).toEqual([
    {
      markIndexes: [0],
      channel: 'shape',
      shared: [['SNV', 'deletion']],
      pinned: ['SNV', 'deletion', 'insertion'],
    },
  ])
  expect(sharedKeysOf([section(['SNV', 'deletion'])])).toEqual([])
  expect(sharedKeysOf([section(['insertion'])])[0]?.pinned).toEqual([
    'insertion',
    'SNV',
    'deletion',
  ])
})

test('Pin distinct shapes lists the colliding values in the domain, and the key then draws each its own', () => {
  const { display } = createTestEnvironment({
    marks: [{ mark: 'point', encoding: { y: 'QUAL', shape: 'type' } }],
  }).createDisplay()
  display.setRpcData(0, workerResult(display, VARIANTS), REGION)
  const shapesOf = () => {
    const scale = display.rpcDataMap.get(0)!.layers[0]!.shapeScale!
    return new Set(scale.entries.map(e => e.shape)).size
  }
  expect(shapesOf()).toBeLessThan(3)
  expect(display.sharedKeys.map(k => k.channel)).toEqual(['shape'])
  expect(display.cornerNotices.join('\n')).toMatch(
    /share one shape.*Pin distinct shapes/,
  )
  display.pinDistinct('shape')
  expect(
    [...getSnapshot(display.conf.marks[0]!.encoding.shape).domain].sort(),
  ).toEqual(['SNV', 'deletion', 'insertion'])
  display.setRpcData(0, workerResult(display, VARIANTS), REGION)
  expect(shapesOf()).toBe(3)
  expect(display.sharedKeys).toEqual([])
})

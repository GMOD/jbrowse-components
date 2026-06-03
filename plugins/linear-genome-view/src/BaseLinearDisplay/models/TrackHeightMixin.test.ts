import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import TrackHeightMixin from './TrackHeightMixin'

// Minimal model: TrackHeightMixin's height getter only reads `configuration`
// when no override is set, so these back-compat cases (which always set an
// override) don't need a real config.
const TestModel = types.compose(
  'TestHeight',
  TrackHeightMixin(),
  types.model({ type: types.literal('test') }),
)

test('legacy heightPreConfig snapshot migrates to heightOverride', () => {
  const m = TestModel.create({ type: 'test', heightPreConfig: 300 })
  expect(m.heightOverride).toBe(300)
  expect(m.height).toBe(300)
  expect(getSnapshot(m)).not.toHaveProperty('heightPreConfig')
})

test('legacy bare height snapshot migrates to heightOverride', () => {
  const m = TestModel.create({ type: 'test', height: 250 })
  expect(m.heightOverride).toBe(250)
  expect(m.height).toBe(250)
})

test('current heightOverride snapshot is preserved', () => {
  const m = TestModel.create({ type: 'test', heightOverride: 180 })
  expect(m.heightOverride).toBe(180)
})

test('heightOverride wins over a stale legacy height', () => {
  const m = TestModel.create({
    type: 'test',
    height: 999,
    heightOverride: 180,
  })
  expect(m.heightOverride).toBe(180)
})

test('setHeight and resizeHeight write heightOverride', () => {
  const m = TestModel.create({ type: 'test', heightOverride: 100 })
  m.setHeight(220)
  expect(m.heightOverride).toBe(220)
  m.resizeHeight(30)
  expect(m.heightOverride).toBe(250)
})

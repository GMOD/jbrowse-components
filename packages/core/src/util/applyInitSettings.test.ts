import { types } from '@jbrowse/mobx-state-tree'

import { applyInitSettings } from './applyInitSettings.ts'

// A view-shaped model: a mixin contributing a setting, the view's own settings,
// and the two kinds of key a launcher owns — `views`, whose name collides with
// a property meaning something else, and `loc`, which has no property at all.
const Mixin = types.model('Mixin', {
  colorBy: types.optional(types.string, 'default'),
})

const Row = types.model('Row', { name: types.string })

const View = types.compose(
  'View',
  Mixin,
  types.model({
    id: types.optional(types.identifier, 'v1'),
    type: types.optional(types.literal('View'), 'View'),
    init: types.frozen<Record<string, unknown> | undefined>(),
    alpha: types.optional(types.number, 0.2),
    drawCurves: types.optional(types.boolean, false),
    views: types.array(Row),
  }),
)

const make = () => View.create({ views: [{ name: 'built' }] })

test('a declared property is applied with no code naming it', () => {
  const v = make()
  const report = applyInitSettings(v, { drawCurves: true, alpha: 0.9 })
  expect(v.drawCurves).toBe(true)
  expect(v.alpha).toBe(0.9)
  expect(report.applied).toEqual(['drawCurves', 'alpha'])
})

test('a property a composed mixin brought in is applied too', () => {
  const v = make()
  applyInitSettings(v, { colorBy: 'strand' })
  expect(v.colorBy).toBe('strand')
})

// The collision that makes `commands` necessary rather than a nicety: a spec's
// `views` is a list of assemblies for the launcher to open, and the model's
// `views` is the rows it built out of them. Without the skip this would replace
// the rows with the request.
test('a command key is left to the caller even when a property shares its name', () => {
  const v = make()
  const report = applyInitSettings(
    v,
    { views: [{ assembly: 'hg38' }], drawCurves: true },
    { commands: ['views'] },
  )
  expect(v.views.map(r => r.name)).toEqual(['built'])
  expect(report.applied).toEqual(['drawCurves'])
  expect(report.unknown).toEqual([])
})

test('a key with no property behind it is reported, not applied', () => {
  const v = make()
  const report = applyInitSettings(v, { drawCurvez: true })
  expect(report.unknown).toEqual(['drawCurvez'])
})

// init blobs arrive from URLs, so a bad value must cost that key and nothing
// else — MST would otherwise throw out of the whole patch and take the good
// keys in it down as well.
test('a value the property type rejects is dropped, and the rest still apply', () => {
  const v = make()
  const report = applyInitSettings(v, { alpha: 'loud', drawCurves: true })
  expect(report.invalid).toEqual(['alpha'])
  expect(v.alpha).toBe(0.2)
  expect(v.drawCurves).toBe(true)
})

test('identity and plumbing keys are never writable from an init blob', () => {
  const v = make()
  const report = applyInitSettings(v, {
    id: 'hijacked',
    type: 'OtherView',
    init: { alpha: 1 },
  })
  expect(v.id).toBe('v1')
  expect(report.applied).toEqual([])
  expect(report.unknown).toEqual([])
})

test('an explicit undefined leaves the property at its current value', () => {
  const v = make()
  applyInitSettings(v, { drawCurves: true })
  applyInitSettings(v, { drawCurves: undefined })
  expect(v.drawCurves).toBe(true)
})

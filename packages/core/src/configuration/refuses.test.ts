import { ConfigurationSchema } from './configurationSchema.ts'
import { applyConfSettings, setConf } from './getConf.ts'
import { readConfObject } from './readConfObject.ts'
import { slotValueRefusal } from './slotFacade.ts'

const MESSAGE = "under field name a row's own color is the map beside it"

const channel = ConfigurationSchema(
  'RefusingChannel',
  {
    field: { type: 'string', defaultValue: 'name' },
    scale: ConfigurationSchema('RefusingScale', {
      domain: { type: 'stringArray', defaultValue: [] },
      range: { type: 'stringArray', defaultValue: [] },
    }),
  },
  {
    shorthand: 'field',
    writes: 'whole',
    refuses: [
      {
        id: 'by-name',
        when: { field: ['name'] },
        slots: ['scale.domain'],
        message: MESSAGE,
      },
    ],
  },
)

const rows = ConfigurationSchema('RefusingRows', { color: channel })

const display = ConfigurationSchema(
  'RefusingDisplay',
  { rows },
  { explicitlyTyped: true, explicitIdentifier: 'displayId' },
)

const NAME_PAIRS = { scale: { domain: ['a'], range: ['#f00'] } }

function warningsOf(load: () => unknown) {
  const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  load()
  const warnings = spy.mock.calls.map(([message]) => message)
  spy.mockRestore()
  return warnings
}

test('a load names the refused member once and loads without it', () => {
  let conf = display.create({ displayId: 'load0' })
  const warnings = warningsOf(() => {
    conf = display.create({
      displayId: 'load1',
      rows: { color: NAME_PAIRS },
    })
    display.create({ displayId: 'load2', rows: { color: NAME_PAIRS } })
  })
  expect(warnings).toEqual([
    `RefusingChannel.scale.domain: ${MESSAGE}: loading without it`,
  ])
  expect(readConfObject(conf, ['rows', 'color', 'scale', 'domain'])).toEqual([])
  expect(readConfObject(conf, ['rows', 'color', 'scale', 'range'])).toEqual([
    '#f00',
  ])
})

test('another field takes the member', () => {
  const conf = display.create({
    displayId: 'attribute',
    rows: { color: { field: 'group', ...NAME_PAIRS } },
  })
  expect(readConfObject(conf, ['rows', 'color', 'scale', 'domain'])).toEqual([
    'a',
  ])
})

test('a whole write refuses it, naming the path and why', () => {
  const conf = display.create({ displayId: 'whole' })
  expect(() => {
    setConf(conf, ['rows', 'color'], NAME_PAIRS)
  }).toThrow(`rows.color.scale.domain: ${MESSAGE}`)
  expect(readConfObject(conf, ['rows', 'color', 'scale', 'range'])).toEqual([])
})

test('a member write refuses it, from either side of the condition', () => {
  const conf = display.create({
    displayId: 'member',
    rows: { color: { field: 'group', ...NAME_PAIRS } },
  })
  expect(() => {
    setConf(conf, ['rows', 'color', 'field'], 'name')
  }).toThrow(`rows.color.scale.domain: ${MESSAGE}`)
  expect(readConfObject(conf, ['rows', 'color', 'field'])).toBe('group')

  const byName = display.create({ displayId: 'member2' })
  expect(() => {
    setConf(byName, ['rows', 'color', 'scale', 'domain'], ['a'])
  }).toThrow(`rows.color.scale.domain: ${MESSAGE}`)
  expect(() => {
    setConf(byName.rows.color.scale, 'domain', ['a'])
  }).toThrow(MESSAGE)
  setConf(byName, ['rows', 'color', 'scale', 'range'], ['#f00'])
  setConf(byName, ['rows', 'color', 'scale', 'domain'], [])
  expect(readConfObject(byName, ['rows', 'color', 'scale', 'range'])).toEqual([
    '#f00',
  ])
})

test('a settings bag fails the key alone', () => {
  const conf = display.create({ displayId: 'bag' })
  const report = applyConfSettings(conf, { rows: { color: NAME_PAIRS } })
  expect(report.failed.map(f => f.key)).toEqual(['rows'])
  expect(report.failed[0]!.error).toContain(MESSAGE)
})

test("displayDefaults routing's check refuses it", () => {
  expect(slotValueRefusal(display, 'rows', { color: NAME_PAIRS })).toContain(
    MESSAGE,
  )
  expect(
    slotValueRefusal(display, 'rows', { color: { field: 'g', ...NAME_PAIRS } }),
  ).toBeUndefined()
})

test('a refusal naming no slot, no value the slot takes, or no path is refused at construction', () => {
  const scale = ConfigurationSchema('RefusalScale', {
    domain: { type: 'stringArray', defaultValue: [] },
  })
  const refusing = (rule: {
    when: Record<string, string[]>
    slots: string[]
  }) =>
    ConfigurationSchema(
      'BadRefusal',
      { field: { type: 'string', defaultValue: 'name' }, scale },
      { refuses: [{ id: 'bad', message: 'no', ...rule }] },
    )
  expect(() =>
    refusing({ when: { kind: ['name'] }, slots: ['scale.domain'] }),
  ).toThrow(/declares no such slot/)
  expect(() =>
    refusing({ when: { field: ['name'] }, slots: ['scale.order'] }),
  ).toThrow(/refuses "scale.order", and RefusalScale declares no "order"/)
})

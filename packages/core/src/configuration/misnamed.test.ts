import { ConfigurationSchema } from './configurationSchema.ts'
import { setConf } from './getConf.ts'
import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import { refusingUndeclaredKeys } from './snapshotPreprocess.ts'

const rows = ConfigurationSchema(
  'MisnamedRows',
  { step: { type: 'number', defaultValue: 10 } },
  { closed: true, misnamed: { height: 'step' } },
)

const display = ConfigurationSchema(
  'MisnamedDisplay',
  { rows, color: { type: 'color', defaultValue: 'grey' } },
  {
    explicitlyTyped: true,
    explicitIdentifier: 'displayId',
    misnamed: { rowHeight: 'rows.step' },
  },
)

function warningsOf(load: () => unknown) {
  const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  load()
  const warnings = spy.mock.calls.map(([message]) => message)
  spy.mockRestore()
  return warnings
}

test('a typed entry names the path its file writes on load', () => {
  expect(
    warningsOf(() => display.create({ displayId: 'd1', rowHeight: 12 })),
  ).toEqual([
    'MisnamedDisplay "d1" does not declare rowHeight: loading without it — did you mean rows.step?',
  ])
})

test('a sub-schema names its own member on load', () => {
  expect(
    warningsOf(() => display.create({ displayId: 'd2', rows: { height: 4 } })),
  ).toEqual([
    'MisnamedRows does not declare height: loading without it — did you mean step?',
  ])
})

test('a write refuses the misnamed key with the pointer', () => {
  expect(() =>
    refusingUndeclaredKeys(() => display.create({ rowHeight: 12 })),
  ).toThrow(
    'MisnamedDisplay takes rows, color, type and displayId, not rowHeight — did you mean rows.step?',
  )
  expect(() =>
    refusingUndeclaredKeys(() => rows.create({ height: 4 })),
  ).toThrow('MisnamedRows takes step, not height — did you mean step?')
})

test('a sub-schema written whole names the path from its typed entry', () => {
  const conf = display.create({ displayId: 'd4' })
  expect(() => {
    setConf(conf, 'rows', { height: 4 })
  }).toThrow('MisnamedRows takes step, not height — did you mean rows.step?')
})

test('a single-slot write of a misnamed word names the path', () => {
  const conf = display.create({ displayId: 'd5' })
  expect(() => {
    // @ts-expect-error a misnamed word is no slot
    setConf(conf, 'rowHeight', 1)
  }).toThrow(
    'MisnamedDisplay has no config slot "rowHeight". Valid slots: color — did you mean rows.step?',
  )
  expect(() => {
    // @ts-expect-error a misnamed word is no slot
    setConf(conf, ['rows', 'height'], 1)
  }).toThrow(
    'MisnamedRows has no config slot "height". Valid slots: step — did you mean rows.step?',
  )
})

test('beside other undeclared keys the pointer names the key it answers', () => {
  expect(() =>
    refusingUndeclaredKeys(() =>
      display.create({ rowHeight: 12, colour: 'red' }),
    ),
  ).toThrow(
    'MisnamedDisplay takes rows, color, type and displayId, not rowHeight, colour — did you mean rows.step for rowHeight?',
  )
})

test('an undeclared key not in misnamed keeps the plain message', () => {
  expect(
    warningsOf(() => display.create({ displayId: 'd3', colour: 'red' })),
  ).toEqual([
    'MisnamedDisplay "d3" does not declare colour: loading without it',
  ])
  expect(() =>
    refusingUndeclaredKeys(() => display.create({ colour: 'red' })),
  ).toThrow(
    /^MisnamedDisplay takes rows, color, type and displayId, not colour$/,
  )
})

test('a subclass adds to its base misnamed', () => {
  const child = ConfigurationSchema(
    'MisnamedChild',
    { width: { type: 'number', defaultValue: 1 } },
    { baseConfiguration: display, misnamed: { size: 'width' } },
  )
  expect(getConfigurationSchemaMetadata(child)!.options.misnamed).toEqual({
    rowHeight: 'rows.step',
    size: 'width',
  })
})

test('a misnamed key the schema declares is refused', () => {
  expect(() =>
    ConfigurationSchema(
      'MisnamedDeclared',
      { step: { type: 'number', defaultValue: 1 } },
      { misnamed: { step: 'step' } },
    ),
  ).toThrow(
    "MisnamedDeclared's misnamed names step, which it declares, so a snapshot writing step means that member",
  )
})

test('a misnamed target whose first member is undeclared is refused', () => {
  expect(() =>
    ConfigurationSchema(
      'MisnamedNowhere',
      { step: { type: 'number', defaultValue: 1 } },
      { misnamed: { rowHeight: 'rows.step' } },
    ),
  ).toThrow(
    "MisnamedNowhere's misnamed points rowHeight at rows.step, but it declares no rows",
  )
})

test('a misnamed key a retired spelling also lifts is refused', () => {
  expect(() =>
    ConfigurationSchema(
      'MisnamedRetired',
      { step: { type: 'number', defaultValue: 1 } },
      {
        retired: { height: value => ({ step: value }) },
        misnamed: { height: 'step' },
      },
    ),
  ).toThrow(
    "MisnamedRetired's misnamed names height, which its retired lifts: a key is a spelling that moved, which a load rewrites, or a word that never was a key, not both",
  )
})

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

describe('a dotted key naming a declared path', () => {
  test('a load points at the nested spelling', () => {
    expect(
      warningsOf(() => display.create({ displayId: 'd6', 'rows.step': 12 })),
    ).toEqual([
      'MisnamedDisplay "d6" does not declare rows.step: loading without it — did you mean rows: { step }?',
    ])
  })

  test('a write refuses it with the nested spelling', () => {
    expect(() =>
      refusingUndeclaredKeys(() => display.create({ 'rows.step': 12 })),
    ).toThrow(
      'MisnamedDisplay takes rows, color, type and displayId, not rows.step — did you mean rows: { step }?',
    )
    const conf = display.create({ displayId: 'd7' })
    expect(() => {
      // @ts-expect-error a dotted key is no slot
      setConf(conf, 'rows.step', 1)
    }).toThrow(
      'MisnamedDisplay has no config slot "rows.step". Valid slots: color — did you mean rows: { step }?',
    )
  })

  test('a sub-schema written whole spells it from the typed entry', () => {
    const deep = ConfigurationSchema(
      'DottedDeepDisplay',
      {
        rows: ConfigurationSchema(
          'DottedDeepRows',
          {
            axis: ConfigurationSchema('DottedDeepAxis', {
              width: { type: 'number', defaultValue: 1 },
            }),
          },
          { closed: true },
        ),
      },
      { explicitlyTyped: true, explicitIdentifier: 'displayId' },
    )
    const conf = deep.create({ displayId: 'd8' })
    expect(() => {
      setConf(conf, 'rows', { 'axis.width': 150 })
    }).toThrow(
      'DottedDeepRows takes axis, not axis.width — did you mean rows: { axis: { width } }?',
    )
  })

  test('a dotted key the schema does not declare keeps the plain message', () => {
    expect(
      warningsOf(() => display.create({ displayId: 'd9', 'rows.height': 4 })),
    ).toEqual([
      'MisnamedDisplay "d9" does not declare rows.height: loading without it',
    ])
  })
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

describe('a word that could mean either of two paths', () => {
  const colors = ConfigurationSchema(
    'MisnamedColorsDisplay',
    {
      rows: ConfigurationSchema('MisnamedColorsRows', {
        colors: { type: 'stringMap', defaultValue: {} },
        color: { type: 'string', defaultValue: 'name' },
      }),
    },
    {
      explicitlyTyped: true,
      explicitIdentifier: 'displayId',
      misnamed: { rowColor: ['rows.colors', 'rows.color'] },
    },
  )

  test('a load names both paths', () => {
    expect(
      warningsOf(() => colors.create({ displayId: 'c1', rowColor: {} })),
    ).toEqual([
      'MisnamedColorsDisplay "c1" does not declare rowColor: loading without it — did you mean rows.colors or rows.color?',
    ])
  })

  test('beside other undeclared keys both paths answer the key', () => {
    expect(() =>
      refusingUndeclaredKeys(() =>
        colors.create({ rowColor: {}, rowHeight: 4 }),
      ),
    ).toThrow(
      'MisnamedColorsDisplay takes rows, type and displayId, not rowColor, rowHeight — did you mean rows.colors or rows.color for rowColor?',
    )
  })

  test('each path must name a declared member', () => {
    expect(() =>
      ConfigurationSchema(
        'MisnamedHalfNowhere',
        { rows: { type: 'string', defaultValue: '' } },
        { misnamed: { rowColor: ['rows.colors', 'tint.color'] } },
      ),
    ).toThrow(
      "MisnamedHalfNowhere's misnamed points rowColor at tint.color, but it declares no tint",
    )
  })
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

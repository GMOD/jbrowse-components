import {
  getMembers,
  getSnapshot,
  setTypeChecking,
  types,
} from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from './configurationSchema.ts'
import {
  ConfigurationSchemaUnion,
  arraySlotUnion,
} from './configurationSchemaUnion.ts'
import { readConfObject } from './readConfObject.ts'
import { getConfigurationSchemaUnion } from './schemaRegistry.ts'
import { getTypeNamesFromExplicitlyTypedUnion } from './schemaTypes.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
function assertType<Check extends true>(_check?: Check): void {}

const filter = ConfigurationSchema(
  'filter',
  { expr: { type: 'string', defaultValue: '' } },
  { explicitlyTyped: true, closed: true },
)
const bin = ConfigurationSchema(
  'bin',
  {
    step: { type: 'number', defaultValue: 10000 },
    field: { type: 'string', defaultValue: 'start' },
  },
  { explicitlyTyped: true, closed: true },
)
const Step = ConfigurationSchemaUnion('Step', { filter, bin })
const Host = ConfigurationSchema('StepHost', { transform: types.array(Step) })

function inProduction(run: () => void) {
  setTypeChecking(false)
  try {
    run()
  } finally {
    setTypeChecking(undefined)
  }
}

test('each member loads as its own schema, keeping its type when all-default', () => {
  const host = Host.create({
    transform: [{ type: 'bin', step: 500 }, { type: 'filter' }],
  })
  expect(getSnapshot(host)).toEqual({
    transform: [{ type: 'bin', step: 500 }, { type: 'filter' }],
  })
  expect(readConfObject(host.transform[0], 'step')).toBe(500)
  expect(readConfObject(host.transform[0], 'field')).toBe('start')
})

test("a member node reads its type as its key, and a switch narrows to that member's slots", () => {
  assertType<Equal<Instance<typeof Step>['type'], 'filter' | 'bin'>>()
  function operand(step: Instance<typeof Step>) {
    switch (step.type) {
      case 'filter':
        return step.expr
      case 'bin':
        return step.step
    }
  }
  function misread(step: Instance<typeof Step>) {
    // @ts-expect-error a filter has no step
    return step.type === 'filter' ? step.step : undefined
  }
  expect(operand(Step.create({ type: 'bin', step: 5 }))).toBe(5)
  expect(operand(Step.create({ type: 'filter', expr: 'x' }))).toBe('x')
  expect(misread(Step.create({ type: 'filter' }))).toBeUndefined()
})

test('a snapshot naming no type, or a type no member answers to, is refused', () => {
  expect(() => Host.create({ transform: [{ step: 5 }] })).toThrow(
    'a Step names its type, one of filter and bin, and names none',
  )
  expect(() => Host.create({ transform: [{ type: 'nope' }] })).toThrow(
    'a Step names its type, one of filter and bin, not "nope"',
  )
  expect(() => Host.create({ transform: [{ type: 'constructor' }] })).toThrow(
    'not "constructor"',
  )
})

test('the refusal holds in a production build, where MST checks no type', () => {
  inProduction(() => {
    expect(() => Host.create({ transform: [{ step: 5 }] })).toThrow(
      'and names none',
    )
    const host = Host.create({ transform: [{ type: 'bin', step: 5 }] })
    expect(() => {
      host.setSubschemaArray('transform', [{ type: 'nope' }])
    }).toThrow('not "nope"')
    expect(getSnapshot(host)).toEqual({
      transform: [{ type: 'bin', step: 5 }],
    })
  })
})

test('a key belonging to another member is refused, not dropped', () => {
  expect(() =>
    Host.create({ transform: [{ type: 'filter', step: 50 }] }),
  ).toThrow('filter takes expr and type, not step')
  inProduction(() => {
    expect(() =>
      Host.create({ transform: [{ type: 'bin', expr: 'x' }] }),
    ).toThrow('bin takes step, field and type, not expr')
  })
})

test('a whole-list write replaces, removes, appends and reorders, and each reloads', () => {
  const host = Host.create({
    transform: [
      { type: 'filter', expr: 'a' },
      { type: 'bin', step: 500, field: 'end' },
    ],
  })
  const edits: ((list: unknown[]) => unknown[])[] = [
    list => list.with(1, { type: 'filter' }),
    list => list.toSpliced(0, 1),
    list => [...list, { type: 'bin', step: 7 }],
    list => list.toReversed(),
  ]
  for (const edit of edits) {
    host.setSubschemaArray('transform', edit([...getSnapshot(host).transform!]))
    const snapshot = getSnapshot(host)
    expect(getSnapshot(Host.create(snapshot))).toEqual(snapshot)
  }
  expect(getSnapshot(host)).toEqual({
    transform: [{ type: 'bin', step: 7 }, { type: 'filter' }],
  })
})

test('the vocabulary is the record keys, read back off the union', () => {
  expect(getTypeNamesFromExplicitlyTypedUnion(Step)).toEqual(['filter', 'bin'])
  expect(getConfigurationSchemaUnion(Step)?.name).toBe('Step')
  expect(Object.keys(getConfigurationSchemaUnion(Step)!.members)).toEqual([
    'filter',
    'bin',
  ])
})

test("an array slot's union is found from the slot's own type", () => {
  const { properties } = getMembers(Host.create())
  expect(arraySlotUnion(properties.transform!)?.name).toBe('Step')
  expect(arraySlotUnion(types.array(filter))).toBeUndefined()
})

describe('a member the union cannot trust is refused at construction', () => {
  test('a record key its schema does not name itself by', () => {
    expect(() =>
      ConfigurationSchemaUnion('Mistyped', { fliter: filter }),
    ).toThrow('Mistyped lists "fliter", whose schema names itself "filter"')
  })

  test('an open member', () => {
    const open = ConfigurationSchema(
      'open',
      { expr: { type: 'string', defaultValue: '' } },
      { explicitlyTyped: true },
    )
    expect(() => ConfigurationSchemaUnion('Open', { filter, open })).toThrow(
      'Open lists "open", which is not closed',
    )
  })

  test('a member with no type of its own', () => {
    const untyped = ConfigurationSchema(
      'untyped',
      { expr: { type: 'string', defaultValue: '' } },
      { closed: true },
    )
    expect(() => ConfigurationSchemaUnion('Untyped', { untyped })).toThrow(
      'Untyped lists "untyped", which is not explicitlyTyped',
    )
  })

  test('something that is not a configuration schema', () => {
    expect(() =>
      ConfigurationSchemaUnion('Plain', {
        // @ts-expect-error a member is a configuration schema
        plain: types.model('plain', {}),
      }),
    ).toThrow('Plain lists "plain", which is not a configuration schema')
  })
})

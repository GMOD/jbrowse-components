import {
  applyPatch,
  getSnapshot,
  protect,
  setTypeChecking,
  types,
} from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import { readConfObject } from './index.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const valueScale = ConfigurationSchema('ValueScale', {
  type: {
    type: 'stringEnum',
    model: types.enumeration('', ['linear', 'log']),
    defaultValue: 'linear',
  },
  domainMin: { type: 'maybeNumber' },
  domainMax: { type: 'maybeNumber' },
})

const scales = ConfigurationSchema('Scales', { y: valueScale })

const facet = ConfigurationSchema(
  'Facet',
  {
    field: { type: 'string', defaultValue: '' },
    domain: { type: 'stringArray', defaultValue: [] },
  },
  { shorthand: 'field', closed: true },
)

const display = ConfigurationSchema('Display', {
  height: { type: 'number', defaultValue: 100 },
  scales,
  facet,
})

function node() {
  return display.create(undefined, { pluginManager })
}

describe('claim 1: applyPatch takes an arbitrary-depth path', () => {
  test('writes one member of a nested sub-schema', () => {
    const conf = node()
    applyPatch(conf, { op: 'replace', path: '/scales/y/domainMin', value: 5 })
    expect(readConfObject(conf, ['scales', 'y', 'domainMin'])).toBe(5)
    expect(readConfObject(conf, ['scales', 'y', 'type'])).toBe('linear')
  })

  test('a path segment the schema does not declare throws', () => {
    const conf = node()
    expect(() => {
      applyPatch(conf, {
        op: 'replace',
        path: '/scales/z/domainMin',
        value: 5,
      })
    }).toThrow()
  })
})

describe("claim 2: applyPatch satisfies MST's protection rule from any caller", () => {
  test('a direct assignment throws where applyPatch does not', () => {
    const conf = node()
    protect(conf)
    expect(() => {
      ;(conf as any).height = 200
    }).toThrow(/protected/)
    applyPatch(conf, { op: 'replace', path: '/height', value: 200 })
    expect(readConfObject(conf, 'height')).toBe(200)
  })

  test('works on a node inside a protected containing tree', () => {
    const container = types
      .model({ configuration: display })
      .create(undefined, { pluginManager })
    applyPatch(container.configuration, {
      op: 'replace',
      path: '/scales/y/domainMax',
      value: 9,
    })
    expect(
      readConfObject(container.configuration, ['scales', 'y', 'domainMax']),
    ).toBe(9)
  })
})

describe('claim 3: a whole-object write runs the schema preprocessor', () => {
  test('a bare string lifts through the declared shorthand', () => {
    const conf = node()
    applyPatch(conf, { op: 'replace', path: '/facet', value: 'source' })
    expect(readConfObject(conf, ['facet', 'field'])).toBe('source')
  })

  test('a key the closed schema does not declare is refused', () => {
    const conf = node()
    expect(() => {
      applyPatch(conf, {
        op: 'replace',
        path: '/facet',
        value: { field: 'source', notASlot: ['red'] },
      })
    }).toThrow()
  })

  test('the lift and the refusal also run at depth', () => {
    const conf = node()
    applyPatch(conf, {
      op: 'replace',
      path: '/scales/y',
      value: { type: 'log', domainMin: 1 },
    })
    expect(readConfObject(conf, ['scales', 'y', 'type'])).toBe('log')
    expect(readConfObject(conf, ['scales', 'y', 'domainMin'])).toBe(1)
  })

  test('the node is reconciled in place, not swapped for a new one', () => {
    const conf = node()
    const before = conf.facet
    applyPatch(conf, {
      op: 'replace',
      path: '/facet',
      value: { field: 'source' },
    })
    expect(conf.facet).toBe(before)
  })

  test('a whole-object write REPLACES rather than merges', () => {
    const conf = node()
    applyPatch(conf, {
      op: 'replace',
      path: '/scales/y',
      value: { type: 'log', domainMin: 1 },
    })
    applyPatch(conf, {
      op: 'replace',
      path: '/scales/y',
      value: { domainMax: 7 },
    })
    expect(readConfObject(conf, ['scales', 'y', 'type'])).toBe('linear')
    expect(readConfObject(conf, ['scales', 'y', 'domainMin'])).toBe(undefined)
    expect(readConfObject(conf, ['scales', 'y', 'domainMax'])).toBe(7)
  })
})

describe('claim 4: undefined reconciles a stripDefault property to its default', () => {
  test('a sub-schema handed undefined goes back to its declared defaults', () => {
    const conf = node()
    applyPatch(conf, {
      op: 'replace',
      path: '/facet',
      value: { field: 'source', domain: ['a', 'b'] },
    })
    expect(readConfObject(conf, ['facet', 'domain'])).toEqual(['a', 'b'])
    applyPatch(conf, { op: 'replace', path: '/facet', value: undefined })
    expect(readConfObject(conf, ['facet', 'field'])).toBe('')
    expect(readConfObject(conf, ['facet', 'domain'])).toEqual([])
  })

  test('a slot handed undefined goes back to its declared default', () => {
    const conf = node()
    applyPatch(conf, { op: 'replace', path: '/height', value: 250 })
    applyPatch(conf, { op: 'replace', path: '/height', value: undefined })
    expect(readConfObject(conf, 'height')).toBe(100)
  })

  test('the parent snapshot drops the defaulted sub-schema again', () => {
    const conf = node()
    applyPatch(conf, {
      op: 'replace',
      path: '/facet',
      value: { field: 'source' },
    })
    expect(Object.keys(getSnapshot(conf))).toContain('facet')
    applyPatch(conf, { op: 'replace', path: '/facet', value: undefined })
    expect(Object.keys(getSnapshot(conf))).not.toContain('facet')
  })
})

describe('what applyPatch does NOT carry: the two setSlot guards', () => {
  test('a misspelled slot name', () => {
    const conf = node()
    let threw = false
    try {
      applyPatch(conf, { op: 'replace', path: '/hieght', value: 200 })
    } catch {
      threw = true
    }
    // it does not: nothing throws and nothing lands, which is the failure
    // mode ADR-052's guard on setSlot exists to replace
    expect(threw).toBe(false)
    expect(readConfObject(conf, 'height')).toBe(100)
  })

  test('a value the slot type cannot take, with MST type checking off', () => {
    const conf = node()
    setTypeChecking(false)
    let threw = false
    try {
      applyPatch(conf, { op: 'replace', path: '/height', value: 'big' })
    } catch {
      threw = true
    } finally {
      setTypeChecking(undefined)
    }
    // likewise silent: setSlot's `.is(value)` check is the only thing that
    // catches a value a production build would drop
    expect(threw).toBe(false)
    expect(readConfObject(conf, 'height')).toBe(100)
  })
})

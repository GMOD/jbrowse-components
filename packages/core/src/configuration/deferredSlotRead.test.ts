import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import { getConf } from './getConf.ts'
import { readConfObject } from './readConfObject.ts'

/**
 * A `jexl:` slot value is an expression *about* something. `readConfObject` is
 * the reader that binds that something — and its `args` parameter is optional,
 * so "read this setting" and "resolve this setting for this feature" are the
 * same call with and without a third argument. These pin what an arg-less read
 * of a callback slot does: it hands back the expression rather than evaluating
 * it against a context where every name is `undefined`.
 *
 * Both spellings of the bug that motivated this are here, because they look
 * nothing like each other from the outside and neither points at the reader:
 * `get(feature,…)` throws (`reading 'get'` — the undefined is the feature), and
 * `split(feature.name,…)` returns `''`, since `split` is total. One display lost
 * its whole render to the first and another silently drew one row for everything
 * on the second.
 */
const pm = new PluginManager([])
pm.createPluggableElements()
pm.configure()

const BY_TYPE = "jexl:get(feature,'type')=='SNV'?'green':'purple'"
const BY_NAME = "jexl:split(feature.name,'#')[0]"

const Schema = ConfigurationSchema('DeferredSlotTest', {
  color: { type: 'color', defaultValue: 'goldenrod' },
  plain: { type: 'string', defaultValue: 'literal' },
  labels: ConfigurationSchema('DeferredSlotTestLabels', {
    name: { type: 'string', defaultValue: BY_TYPE },
  }),
})

const Container = types.model('DeferredSlotTestContainer', {
  configuration: Schema,
})

function makeConfig(snapshot: Record<string, unknown> = {}) {
  return Schema.create(
    { type: 'DeferredSlotTest', ...snapshot },
    { pluginManager: pm },
  )
}

function mockFeature(data: Record<string, unknown> = {}) {
  return {
    get: (key: string) => data[key],
    id: () => 'test-id',
    parent: () => undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural test double
  } as any
}

describe('a callback slot read with context', () => {
  it('evaluates against the bound feature', () => {
    const config = makeConfig({ color: BY_TYPE })

    expect(
      readConfObject(config, 'color', {
        feature: mockFeature({ type: 'SNV' }),
      }),
    ).toBe('green')
    expect(
      readConfObject(config, 'color', {
        feature: mockFeature({ type: 'insertion' }),
      }),
    ).toBe('purple')
  })

  it('evaluates through a nested slot path', () => {
    const config = makeConfig()

    expect(
      readConfObject(config, ['labels', 'name'], {
        feature: mockFeature({ type: 'SNV' }),
      }),
    ).toBe('green')
  })
})

describe('a callback slot read with no context', () => {
  // The throwing spelling. Before this rule the error escaped whatever getter
  // performed the read, which for a display model getter means the display.
  it('returns the expression rather than throwing on an unbound feature', () => {
    const config = makeConfig({ color: BY_TYPE })

    expect(readConfObject(config, 'color')).toBe(BY_TYPE)
  })

  // The silent spelling, and the worse of the two: every function in the
  // expression is total, so it produced a plausible value ('') that flowed on
  // as if it were the setting.
  it('returns the expression rather than a value derived from nothing', () => {
    const config = makeConfig({ color: BY_NAME })

    expect(readConfObject(config, 'color')).toBe(BY_NAME)
  })

  it('applies through a nested slot path', () => {
    expect(readConfObject(makeConfig(), ['labels', 'name'])).toBe(BY_TYPE)
  })

  it('applies to getConf, which is the same read', () => {
    const model = Container.create(
      { configuration: { type: 'DeferredSlotTest', color: BY_TYPE } },
      { pluginManager: pm },
    )

    expect(getConf(model, 'color')).toBe(BY_TYPE)
  })

  // The rule keys on `args` being empty, not on the slot declaring
  // `contextVariable` — that declaration is config-editor metadata, and a slot
  // is free to forget it (`partitionField` did). Nothing here declares one.
  it('needs no contextVariable declaration to hold', () => {
    expect(
      Object.hasOwn(
        Schema.create({ type: 'DeferredSlotTest' }, { pluginManager: pm }),
        'contextVariable',
      ),
    ).toBe(false)
    expect(readConfObject(makeConfig({ color: BY_TYPE }), 'color')).toBe(
      BY_TYPE,
    )
  })
})

describe('what the rule does not cover', () => {
  // Honest limitation. Emptiness is the signal, so a read that passes SOME
  // context still evaluates — and if it isn't the context the expression wanted,
  // that read is back to resolving names against undefined. Nothing in the repo
  // reads a feature callback with non-feature args today; the real repair is for
  // a call site to be able to say which of the reader's two jobs it wants.
  // agent-docs/TODO.md, "Deferred config slots are typed as if they were
  // resolved".
  it('still evaluates when unrelated context is supplied', () => {
    const config = makeConfig({ color: BY_NAME })

    expect(readConfObject(config, 'color', { refName: 'ctgA' })).toBe('')
  })
})

describe('reads that are not callbacks are untouched', () => {
  it('returns a plain slot value with no args', () => {
    expect(readConfObject(makeConfig(), 'plain')).toBe('literal')
  })

  it('returns a plain slot value with args', () => {
    expect(
      readConfObject(makeConfig(), 'plain', { feature: mockFeature() }),
    ).toBe('literal')
  })

  it('leaves an empty jexl body alone, which never compiled anyway', () => {
    // `jexl:` mid-typing in the config editor (#4181) — returned literally by
    // `evaluateJexl`, and now short-circuited one step earlier by the same
    // reasoning. Either way the editor sees what the user typed.
    expect(readConfObject(makeConfig({ color: 'jexl:' }), 'color')).toBe(
      'jexl:',
    )
  })

  it('returns the whole-config snapshot with callbacks intact', () => {
    // The no-slotPath overload never evaluated anything; asserted so the two
    // paths stay in agreement about what a stored callback reads as.
    const snap = readConfObject(makeConfig({ color: BY_TYPE }))

    expect(snap.color).toBe(BY_TYPE)
  })
})

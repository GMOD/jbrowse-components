import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import LegendMixin from './LegendMixin.ts'

import type { LegendConfHost } from './LegendMixin.ts'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'

// The six displays composing this had, between them, tests that would notice a
// wrong `showLegend` on two — alignments and the multi-sample variants. Hi-C,
// multi-row features, multi-wiggle and LD had none, so the getter could have
// been inverted on four displays in silence. Consolidating the implementation is
// what makes that fixable in one place, and this is that place.

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

function makeSession({
  defaultValue,
  configuration = {},
  colorScales = [],
}: {
  defaultValue: boolean
  configuration?: Record<string, unknown>
  colorScales?: ColorScale[]
}) {
  const configSchema = ConfigurationSchema('TestLegendDisplay', {
    showLegend: {
      type: 'boolean',
      description: 'show the legend',
      defaultValue,
    },
  })
  const Display = types
    .compose(
      'TestLegendDisplay',
      LegendMixin(),
      types.model({
        type: types.literal('TestLegendDisplay'),
        configuration: configSchema,
      }),
    )
    .views(() => ({
      get colorScales(): ColorScale[] {
        return colorScales
      },
    }))
  const Session = types
    .model('TestSession', {
      rpcManager: types.frozen({}),
      configuration: types.frozen({}),
      display: Display,
    })
    .volatile(() => ({
      lastAction: undefined as
        | { name: string; onClick: () => void }
        | undefined,
    }))
    .actions(self => ({
      notify(
        _message: string,
        _level?: string,
        action?: { name: string; onClick: () => void },
      ) {
        self.lastAction = action
      },
    }))
  const session = Session.create(
    { display: { type: 'TestLegendDisplay', configuration } },
    { pluginManager },
  )
  return { session, display: session.display }
}

// The default is what still differs per display — off for Hi-C, alignments and
// LD, on for the variants, multi-row and multi-wiggle — so it is the axis worth
// running everything over rather than picking one.
describe.each([true, false])('with default %p', defaultValue => {
  it('falls back to the slot default when nothing is set', () => {
    const { display } = makeSession({ defaultValue })
    expect(display.showLegend).toBe(defaultValue)
  })

  it('takes an explicit track value in either direction', () => {
    for (const value of [true, false]) {
      const { display } = makeSession({
        defaultValue,
        configuration: { showLegend: value },
      })
      expect(display.showLegend).toBe(value)
    }
  })

  it('setShowLegend writes the slot, both ways', () => {
    const { display } = makeSession({ defaultValue })
    display.setShowLegend(!defaultValue)
    expect(display.showLegend).toBe(!defaultValue)
    display.setShowLegend(defaultValue)
    expect(display.showLegend).toBe(defaultValue)
  })
})

const genotypes: ColorScale = {
  kind: 'categorical',
  id: 'genotypes',
  title: 'Genotypes',
  entries: [{ value: 'ref', label: 'Reference', color: 'grey' }],
}
const groups: ColorScale = {
  kind: 'categorical',
  id: 'group',
  title: 'Population',
  entries: [{ value: 'AFR', label: 'AFR', color: 'red' }],
}

describe('the key derives from the scales', () => {
  it('a display declaring no scales has no key to offer', () => {
    const { display } = makeSession({ defaultValue: true })
    expect(display.colorScales).toEqual([])
    expect(display.legendSpec.sections).toEqual([])
    expect(display.hasLegendKey).toBe(false)
    expect(display.svgLegendWidth()).toBe(0)
  })

  it('one section per scale, in the order declared', () => {
    const { display } = makeSession({
      defaultValue: true,
      colorScales: [genotypes, groups],
    })
    expect(display.hasLegendKey).toBe(true)
    expect(display.legendSpec.sections!.map(s => s.id)).toEqual([
      'genotypes',
      'group',
    ])
  })

  it('an empty scale is no key', () => {
    const { display } = makeSession({
      defaultValue: true,
      colorScales: [{ ...genotypes, entries: [] }],
    })
    expect(display.hasLegendKey).toBe(false)
  })

  // Re-showing the whole legend is what un-dismisses the sections inside it,
  // the behaviour the multi-sample variant base used to override the setter for.
  it('a dismissed section leaves the key until the legend is shown again', () => {
    const { display } = makeSession({
      defaultValue: true,
      colorScales: [genotypes, groups],
    })
    display.dismissLegendSection('group')
    expect(display.legendSpec.sections!.map(s => s.id)).toEqual(['genotypes'])
    display.setShowLegend(false)
    expect(display.dismissedLegendSections).toEqual(['group'])
    display.setShowLegend(true)
    expect(display.legendSpec.sections!.map(s => s.id)).toEqual([
      'genotypes',
      'group',
    ])
  })
})

// One line per mixin, and the whole point of it: a host cast widened back to
// `AnyConfigurationModel` compiles and checks nothing, so every slot name below
// it typechecks and a misspelled read reports nothing at any layer.
// `HostChecksSlotNames` resolves to `false` there, and this annotation fails.
const legendPin: HostChecksSlotNames<LegendConfHost> = true
test('the mixin checks the slot name it reads', () => {
  expect(legendPin).toBe(true)
})

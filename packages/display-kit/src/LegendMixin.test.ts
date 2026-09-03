import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import LegendMixin from './LegendMixin.ts'

import type { LegendHost } from './LegendMixin.ts'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'

// The six displays composing this had, between them, tests that would notice a
// wrong `showLegend` on two — alignments and the multi-sample variants. Hi-C,
// multi-row features, multi-wiggle and LD had none, so the getter could have
// been inverted on four displays in silence. Consolidating the implementation is
// what makes that fixable in one place, and this is that place.
//
// It runs against a REAL promotable slot and a session that answers
// `getDisplayTypeDefault`, because the whole point of these three members is the
// cascade: a plain `getConf` would pass every assertion here except the two that
// matter.

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

function makeSession({
  promotedBase,
  configuration = {},
  displayTypeDefaults = {},
}: {
  promotedBase: boolean
  configuration?: Record<string, unknown>
  displayTypeDefaults?: Record<string, Record<string, unknown>>
}) {
  const configSchema = ConfigurationSchema('TestLegendDisplay', {
    showLegend: {
      type: 'maybeBoolean',
      description: 'show the legend',
      promotedBase,
    },
  })
  const Display = types.compose(
    'TestLegendDisplay',
    LegendMixin(),
    types.model({
      type: types.literal('TestLegendDisplay'),
      configuration: configSchema,
    }),
  )
  const Session = types
    .model('TestSession', {
      rpcManager: types.frozen({}),
      configuration: types.frozen({}),
      displayTypeDefaults:
        types.frozen<Record<string, Record<string, unknown>>>(
          displayTypeDefaults,
        ),
      display: Display,
    })
    .volatile(() => ({
      lastAction: undefined as
        | { name: string; onClick: () => void }
        | undefined,
    }))
    .views(self => ({
      getDisplayTypeDefault(displayType: string, slot: string): unknown {
        return self.displayTypeDefaults[displayType]?.[slot]
      },
    }))
    .actions(self => ({
      setDisplayTypeDefault(displayType: string, slot: string, value: unknown) {
        self.displayTypeDefaults = {
          ...self.displayTypeDefaults,
          [displayType]: {
            ...self.displayTypeDefaults[displayType],
            [slot]: value,
          },
        }
      },
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

// `promotedBase` is what still differs per display — off for Hi-C, alignments
// and LD, on for the variants, multi-row and multi-wiggle — so it is the axis
// worth running everything over rather than picking one.
describe.each([true, false])('with promotedBase %p', promotedBase => {
  it('falls back to promotedBase when nothing is set', () => {
    const { display } = makeSession({ promotedBase })
    expect(display.showLegend).toBe(promotedBase)
  })

  it('takes an explicit track value in either direction', () => {
    for (const value of [true, false]) {
      const { display } = makeSession({
        promotedBase,
        configuration: { showLegend: value },
      })
      expect(display.showLegend).toBe(value)
    }
  })

  // The tier that makes this a promotable read rather than a `getConf` one: a
  // display-type default overrides the base for a track that set nothing.
  it('follows the session-wide default over the base', () => {
    const { display } = makeSession({
      promotedBase,
      displayTypeDefaults: { TestLegendDisplay: { showLegend: !promotedBase } },
    })
    expect(display.showLegend).toBe(!promotedBase)
  })

  // ...and a track that DID set something outranks that default, which is the
  // half a one-directional slot would get wrong.
  it('lets a track customize back over a session-wide default', () => {
    const { display } = makeSession({
      promotedBase,
      configuration: { showLegend: promotedBase },
      displayTypeDefaults: { TestLegendDisplay: { showLegend: !promotedBase } },
    })
    expect(display.showLegend).toBe(promotedBase)
  })

  it('setShowLegend writes the slot, both ways', () => {
    const { display } = makeSession({ promotedBase })
    display.setShowLegend(!promotedBase)
    expect(display.showLegend).toBe(!promotedBase)
    display.setShowLegend(promotedBase)
    expect(display.showLegend).toBe(promotedBase)
  })

  // The pin is what `showLegendCheckboxItem` puts on the row, and it names the
  // slot it promotes — the fact `promotableSlotsWithoutPin` audits.
  it('the pin is over showLegend and starts inactive', () => {
    const { display } = makeSession({ promotedBase })
    expect(display.showLegendDisplayTypeDefault.slot).toBe('showLegend')
    expect(display.showLegendDisplayTypeDefault.active).toBe(false)
  })

  // The pin turns the legend on whatever the row shows: beside an unchecked
  // box it reads as "show it everywhere", and it does. The click applies it to
  // the open tracks; the snackbar's one action is what makes it the display
  // type's default.
  it('the pin shows the legend, from a hidden one too', () => {
    const { session, display } = makeSession({ promotedBase })
    display.setShowLegend(false)
    display.showLegendDisplayTypeDefault.toggle()
    expect(display.showLegend).toBe(true)
    session.lastAction!.onClick()
    expect(
      session.getDisplayTypeDefault('TestLegendDisplay', 'showLegend'),
    ).toBe(true)
    expect(display.showLegendDisplayTypeDefault.active).toBe(true)
  })
})

// One line per mixin, and the whole point of it: a host cast widened back to
// `AnyConfigurationModel` — or written as the `ResolvableDisplay & { … }`
// intersection, which re-widens — compiles and checks nothing, so every slot
// name below it typechecks and a misspelled read reports nothing at any layer.
// `HostChecksSlotNames` resolves to `false` there, and this annotation fails.
const legendPin: HostChecksSlotNames<LegendHost> = true
test('the mixin checks the slot name it reads', () => {
  expect(legendPin).toBe(true)
})

import {
  ConfigurationSchema,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { RowHeightMixin } from './RowHeightMixin.ts'
import { rowHeightConfigSchemaFields } from './rowHeightConfigSchemaFields.ts'

import type { RowHeightHost } from './RowHeightMixin.ts'

// The two rules `resolveRowHeight` carries pull in opposite directions — a
// sub-pixel fit height passes through untouched, a non-positive one is floored
// to 1 — so "floor it" is the plausible-looking edit and it is a bug either
// way round. Measured against the three displays composing this mixin, dropping
// the floor fails **only** the multi-sample variants' `rowHeightResolution`
// suite; flooring the sub-pixel case as well fails that one and canvas's
// `trackHeightFloor`. maf pins neither, and `resolveRowHeight` itself has no
// unit test of its own. This file is where one implementation gets one set of
// assertions.
//
// The convention, and which parts of it deliberately stay per display, is
// agent-docs/reference/ROW_HEIGHT_AND_FIT.md.

// The mixin declares `autoRowHeight` and every display overrides it, because the
// height available to rows is a different quantity in each. The override is a
// getter over settable state — the shape all three displays have, and the only
// shape that works, since mobx refuses to write a volatile over a computed.
function makeDisplay({
  rowHeight,
  autoRowHeight = 60,
}: {
  rowHeight?: number
  autoRowHeight?: number
} = {}) {
  const configSchema = ConfigurationSchema('TestRowHeightDisplay', {
    ...rowHeightConfigSchemaFields(),
  })
  return types
    .compose(
      'TestRowHeightDisplay',
      RowHeightMixin(),
      types.model({
        type: types.literal('TestRowHeightDisplay'),
        configuration: configSchema,
      }),
    )
    .volatile(() => ({ fitHeight: autoRowHeight }))
    .views(self => ({
      get autoRowHeight(): number {
        return self.fitHeight
      },
    }))
    .actions(self => ({
      setAutoRowHeight(n: number) {
        self.fitHeight = n
      },
    }))
    .create({
      type: 'TestRowHeightDisplay',
      configuration: configSchema.create({
        type: 'TestRowHeightDisplay',
        ...(rowHeight === undefined ? {} : { rowHeight }),
      }),
    })
}

describe('the slot', () => {
  it('ships the fit sentinel as the default', () => {
    expect(makeDisplay().rowHeight).toBe(0)
  })

  it('reads a configured pin back raw', () => {
    expect(makeDisplay({ rowHeight: 14 }).rowHeight).toBe(14)
  })
})

describe('setRowHeight', () => {
  it('pins the height the resolved getter reports', () => {
    const display = makeDisplay()
    display.setRowHeight(20)
    expect(display.rowHeight).toBe(20)
    expect(display.effectiveRowHeight).toBe(20)
  })

  // The pin has to outlive the display instance — unticking and reticking a
  // track drops the display and keeps the config node — so it lands on
  // `configuration` and nowhere in the display's own snapshot.
  it('writes the config node, not the display snapshot', () => {
    const display = makeDisplay()
    display.setRowHeight(20)
    expect(readConfObject(display.configuration, 'rowHeight')).toBe(20)
    expect('rowHeight' in getSnapshot(display)).toBe(false)
  })
})

describe('effectiveRowHeight', () => {
  it('divides the composing display autoRowHeight in fit mode', () => {
    expect(makeDisplay({ autoRowHeight: 12.5 }).effectiveRowHeight).toBe(12.5)
  })

  it('follows autoRowHeight as the display resizes, in fit mode only', () => {
    const display = makeDisplay()
    display.setAutoRowHeight(30)
    expect(display.effectiveRowHeight).toBe(30)
    display.setRowHeight(9)
    display.setAutoRowHeight(80)
    expect(display.effectiveRowHeight).toBe(9)
  })

  // 3202 samples in a 200px display: the fit height is genuinely 0.0625px, and
  // rounding it up to 1 makes the rows area 16x the height it was asked to fit
  // inside — which re-grows the track and makes fit mode report a scroll it is
  // documented never to have.
  it('passes a sub-pixel fit height through unfloored', () => {
    expect(makeDisplay({ autoRowHeight: 200 / 3202 }).effectiveRowHeight).toBe(
      200 / 3202,
    )
  })

  // Reachable without a bad config: variants' `availableHeight` floors at 0, so
  // a connector zone taller than the whole display makes the fit height exactly
  // 0. Consumers divide by this.
  it('floors a non-positive result, which sub-pixel is not', () => {
    expect(makeDisplay({ autoRowHeight: 0 }).effectiveRowHeight).toBe(1)
    expect(makeDisplay({ autoRowHeight: -5 }).effectiveRowHeight).toBe(1)
  })
})

// `configuration` and `autoRowHeight` are the two host members the mixin reaches
// for, and these pin what each one costs when the host doesn't supply it.
describe('what the mixin assumes of its host', () => {
  // Part typecheck-only, the way `extensionPoints.test.ts` asserts its
  // guarantee: an unused @ts-expect-error fails `pnpm typecheck`, so widening
  // `RowHeightHost` back to `AnyConfigurationModel` fails here. **The host type
  // is what it has to ask.** Asking a `makeDisplay()` instance instead passes
  // whatever the mixin does, because the test's own schema is concrete and
  // checks the name itself — that version of this test passed with the cast
  // widened straight back.
  //
  // Keep each directive on the line above the call it covers, inside the arrow
  // body rather than in front of it: `lint --fix` rewraps an expression-bodied
  // arrow into a block, which leaves the directive covering the `expect(` line
  // and the real error uncovered.
  //
  // The two runtime behaviours are why the compile-time check earns its place.
  // The write is loud and the read is not, so a typo'd read is a row height
  // silently stuck at its default with nothing to grep for.
  it('checks the slot name against the host type the mixin casts to', () => {
    const host = makeDisplay() as unknown as RowHeightHost
    expect(() => {
      // @ts-expect-error
      setConf(host, 'rowHieght', 1)
    }).toThrow(/no config slot/)
    // @ts-expect-error
    expect(getConf(host, 'rowHieght')).toBeUndefined()
  })

  // The declared stub is a 1px row, not a NaN: it resolves the same way the
  // read of an undeclared `autoRowHeight` did before the mixin declared one.
  it('resolves a display that overrides no autoRowHeight to the floor', () => {
    const configSchema = ConfigurationSchema('NoOverride', {
      ...rowHeightConfigSchemaFields(),
    })
    const display = types
      .compose(
        'NoOverride',
        RowHeightMixin(),
        types.model({ configuration: configSchema }),
      )
      .create({ configuration: configSchema.create({}) })
    expect(display.autoRowHeight).toBe(0)
    expect(display.effectiveRowHeight).toBe(1)
  })
})

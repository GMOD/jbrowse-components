import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { RowHeightMixin } from './RowHeightMixin.ts'
import { rowHeightConfigSchemaFields } from './rowHeightConfigSchemaFields.ts'

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

// `autoRowHeight` is what the mixin does NOT declare: the height available to
// rows is a different quantity in each display, so the mixin reads it off the
// composing model. Here it is settable, which is how a test drives the fit
// height directly.
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
    .volatile(() => ({ autoRowHeight }))
    .actions(self => ({
      setAutoRowHeight(n: number) {
        self.autoRowHeight = n
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

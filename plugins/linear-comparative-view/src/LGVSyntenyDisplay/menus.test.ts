import { getSyntenyGroupByMenuItem, getSyntenyShowMenuItems } from './menus.ts'

import type { GroupByType } from '@jbrowse/plugin-alignments'

function makeModel(
  type?: GroupByType,
  hideSelfAlignments = false,
  isChainMode = false,
) {
  return {
    groupBy: type ? { type } : undefined,
    setGroupBy: jest.fn(),
    isChainMode,
    hideSelfAlignments,
    setHideSelfAlignments: jest.fn(),
  }
}

// The menu mixes radios, a divider and a checkbox; every assertion below is
// about the labelled entries, so narrow to those once here.
function items(model: ReturnType<typeof makeModel>) {
  return getSyntenyGroupByMenuItem(model).subMenu.filter(i => 'label' in i)
}

// No "One row per group" here: that toggle is the group's drawn height, not a
// dimension, so the "Show..." menu carries it (`collapseGroupRowsItems`).
test('offers None plus the synteny-applicable dimensions, then the self lane', () => {
  expect(items(makeModel('mateAssembly')).map(i => i.label)).toEqual([
    'None',
    'Mate assembly',
    'Strand',
    'Mapping quality',
    'Hide self-alignment lane',
  ])
})

// Strand and mapping quality vary read by read within a chain, so chain layout
// can't honor them and the worker degrades them to ungrouped. This menu passes a
// fixed option list and had no filter of its own, so both stayed on offer and
// ticked while changing nothing; the shared builder applies the rule now.
test('chain mode drops the dimensions the worker would degrade', () => {
  expect(
    items(makeModel('mateAssembly', false, true)).map(i => i.label),
  ).toEqual(['None', 'Mate assembly', 'Hide self-alignment lane'])
})

test('a stored per-read dimension falls back to None in chain mode', () => {
  expect(
    items(makeModel('mapq', false, true))
      .filter(i => i.checked)
      .map(i => i.label),
  ).toEqual(['None'])
})

test('ungrouped checks None', () => {
  expect(
    items(makeModel())
      .filter(i => i.checked)
      .map(i => i.label),
  ).toEqual(['None'])
})

test('the active dimension is the only dimension checked', () => {
  expect(
    items(makeModel('mateAssembly'))
      .filter(i => i.checked)
      .map(i => i.label),
  ).toEqual(['Mate assembly'])
})

test('picking a dimension sets it; picking None ungroups', () => {
  const model = makeModel('mateAssembly')
  items(model)
    .find(i => i.label === 'Strand')!
    .onClick()
  expect(model.setGroupBy).toHaveBeenCalledWith({ type: 'strand' })

  items(model)
    .find(i => i.label === 'None')!
    .onClick()
  expect(model.setGroupBy).toHaveBeenCalledWith(undefined)
})

// `hiddenGroupKeys` only hides a lane under mate-assembly grouping, so under any
// other dimension the box hid nothing whichever way it was ticked.
test('the self-lane toggle is offered only under mate-assembly grouping', () => {
  expect(items(makeModel('mateAssembly')).map(i => i.label)).toContain(
    'Hide self-alignment lane',
  )
  expect(items(makeModel('strand')).map(i => i.label)).not.toContain(
    'Hide self-alignment lane',
  )
  expect(items(makeModel()).map(i => i.label)).not.toContain(
    'Hide self-alignment lane',
  )
})

test('the self-lane toggle reflects and flips hideSelfAlignments', () => {
  const off = makeModel('mateAssembly')
  const item = items(off).find(i => i.label === 'Hide self-alignment lane')!
  expect(item.checked).toBe(false)
  item.onClick()
  expect(off.setHideSelfAlignments).toHaveBeenCalledWith(true)

  const on = makeModel('mateAssembly', true)
  items(on)
    .find(i => i.label === 'Hide self-alignment lane')!
    .onClick()
  expect(on.setHideSelfAlignments).toHaveBeenCalledWith(false)
})

// Every interbase mark is drawn in the coverage band, and this display defaults
// coverage OFF (the configSchemaF override), unlike the alignments display it
// borrows the menu shape from. So with coverage off the toggle could not change
// anything visible, and it is offered only when it can act.
function makeShowModel(showCoverage: boolean) {
  return {
    showLegend: false,
    setShowLegend: jest.fn(),
    showLegendDisplayTypeDefault: {
      slot: 'showLegend',
      active: false,
      toggle: () => {},
    },
    showCoverage,
    setShowCoverage: jest.fn(),
    showPileup: true,
    setShowPileup: jest.fn(),
    showMismatches: true,
    setShowMismatches: jest.fn(),
    showInterbaseIndicators: true,
    setShowInterbaseIndicators: jest.fn(),
    canCollapseGroupRows: false,
    collapseGroupRows: false,
    setCollapseGroupRows: jest.fn(),
  }
}

function showLabels(showCoverage: boolean) {
  return getSyntenyShowMenuItems(makeShowModel(showCoverage))
    .flatMap(i => ('subMenu' in i ? i.subMenu : [i]))
    .filter(i => 'label' in i)
    .map(i => i.label)
}

test('the interbase toggle is offered only while coverage is drawn', () => {
  expect(showLabels(true)).toContain('Show interbase indicators')
  expect(showLabels(false)).not.toContain('Show interbase indicators')
})

test('the rest of the Show menu does not depend on coverage', () => {
  expect(showLabels(false)).toEqual(
    expect.arrayContaining([
      'Show coverage',
      'Show alignments',
      'Show mismatches',
    ]),
  )
})

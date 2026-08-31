import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'

import type { SvInspectorViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

let warn: jest.SpyInstance

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
})

const warnings = () => warn.mock.calls.map(c => `${c[0]}`)

function open(snap: Record<string, unknown>) {
  return createTestSession().addView(
    'SvInspectorView',
    snap,
  ) as SvInspectorViewModel
}

// No uri, so the forward seeds the sheet's wizard and stops there: what is
// asserted is the partition and the hand-off, not the load.
test('a launch key written on the view object reaches the child sheet', () => {
  const view = open({ assembly: 'volvox', fileType: 'BEDPE' })
  const { importWizard } = view.spreadsheetView
  expect(importWizard.selectedAssemblyName).toBe('volvox')
  expect(importWizard.fileType).toBe('BEDPE')
  expect(view.launch).toBeUndefined()
  expect(warnings()).toEqual([])
})

// Nothing in this view's launch path mentions either name: v4's `init` was
// forwarded whole to the sheet, so a declared property written beside it
// reached nothing.
test('a declared property lands natively, named nowhere in the launch path', () => {
  const view = open({
    assembly: 'volvox',
    height: 900,
    spreadsheetWidthFraction: 0.4,
    onlyDisplayRelevantRegionsInCircularView: true,
  })
  expect(view.height).toBe(900)
  expect(view.spreadsheetWidthFraction).toBe(0.4)
  expect(view.onlyDisplayRelevantRegionsInCircularView).toBe(true)
})

// The two halves are declared properties, so a saved session's persisted pan
// and zoom stays state rather than sorting as a launch key or a typo.
test('a persisted child view stays on its property', () => {
  const view = open({
    circularView: { type: 'CircularView', bpPerPx: 42, autoFit: false },
  })
  expect(view.circularView.bpPerPx).toBe(42)
  expect(view.circularView.autoFit).toBe(false)
  expect(warnings()).toEqual([])
})

describe('the v4 nested form', () => {
  const REMOVED =
    'SvInspectorView nests its settings under "init", which v5 removed: write every setting directly on the view object.'

  test('a nested spec launches nothing and says the key is gone', () => {
    const view = open({ init: { assembly: 'volvox', fileType: 'BEDPE' } })
    expect(view.spreadsheetView.importWizard.selectedAssemblyName).not.toBe(
      'volvox',
    )
    expect(warnings()).toContain(REMOVED)
  })

  test('a declared property nested inside it does not land', () => {
    const view = open({ init: { assembly: 'volvox', height: 900 } })
    expect(view.height).not.toBe(900)
    expect(warnings()).toEqual([REMOVED])
  })
})

test('a key naming neither a launch key nor a property is named on attach', () => {
  open({ assembly: 'volvox', fileTypes: 'BEDPE' })
  expect(warnings()).toContain(
    'SvInspectorView ignored unknown key(s): fileTypes',
  )
})

test('an unknown key is reported once', () => {
  open({ fileTypes: 'BEDPE' })
  expect(warnings()).toHaveLength(1)
})

// Read as work to do, the whole blob is forwarded to the sheet, which then
// seeds its wizard with an assembly nobody named and skips its cached-file
// reload.
test('a typo alone leaves nothing pending', () => {
  const view = open({ fileTypes: 'BEDPE' })
  expect(view.launch).toEqual({ unknown: { fileTypes: 'BEDPE' } })
  expect(view.pendingLaunch).toBeUndefined()
  expect(view.spreadsheetView.importWizard.selectedAssemblyName).toBeUndefined()
})

// Forwarded synchronously, and the sheet caches the file location just as
// synchronously, so this node's copy has nothing left to reconstruct.
test('the launch state is never persisted', () => {
  const snap = getSnapshot(open({ assembly: 'volvox' })) as {
    launch?: unknown
  }
  expect(snap.launch).toBeUndefined()
})

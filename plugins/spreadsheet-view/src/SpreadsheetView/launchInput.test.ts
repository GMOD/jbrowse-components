import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'

import type { SpreadsheetViewModel } from './SpreadsheetViewModel.ts'

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
    'SpreadsheetView',
    snap,
  ) as SpreadsheetViewModel
}

// No uri, so the reaction seeds the wizard and stops: what is asserted is the
// partition, not the load.
test('a launch key written on the view object reaches the wizard', () => {
  const view = open({ assembly: 'volvox', fileType: 'BEDPE' })
  expect(view.importWizard.selectedAssemblyName).toBe('volvox')
  expect(view.importWizard.fileType).toBe('BEDPE')
  expect(view.launch).toBeUndefined()
  expect(warnings()).toEqual([])
})

// Nothing in this view's launch path mentions either name: the partition leaves
// a declared property on the snapshot and MST restores it. v4's applyInit read
// the four launch keys and dropped every other one in silence.
test('a declared property lands natively, named nowhere in the launch path', () => {
  const view = open({
    assembly: 'volvox',
    height: 700,
    hideVerticalResizeHandle: true,
  })
  expect(view.height).toBe(700)
  expect(view.hideVerticalResizeHandle).toBe(true)
})

describe('the v4 nested form', () => {
  test('a nested spec produces the same view, and says it is going', () => {
    const view = open({ init: { assembly: 'volvox', fileType: 'BEDPE' } })
    expect(view.importWizard.selectedAssemblyName).toBe('volvox')
    expect(view.importWizard.fileType).toBe('BEDPE')
    expect(warnings()).toContain(
      'SpreadsheetView nests its settings under "init", which is deprecated: write every setting directly on the view object.',
    )
  })

  test('a declared property nested inside it still lands', () => {
    const view = open({ init: { assembly: 'volvox', height: 700 } })
    expect(view.height).toBe(700)
    expect(warnings()).not.toContain(
      'SpreadsheetView ignored unknown key(s): height',
    )
  })
})

test('a key naming neither a launch key nor a property is named on attach', () => {
  open({ assembly: 'volvox', fileTypes: 'BEDPE' })
  expect(warnings()).toContain(
    'SpreadsheetView ignored unknown key(s): fileTypes',
  )
})

// The partition subsumes captureUnknownSnapshotKeys for this view. Both wired
// up, a typo warns twice.
test('an unknown key is reported once, not once per capture', () => {
  open({ fileTypes: 'BEDPE' })
  expect(warnings()).toHaveLength(1)
})

// Read as work to do, the reaction seeds the wizard with an assembly nobody
// named — and `hadInit` suppresses the cached-file reload a saved session
// depends on, so the sheet comes back empty.
test('a typo alone leaves nothing pending', () => {
  const view = open({ fileTypes: 'BEDPE' })
  expect(view.launch).toEqual({ unknown: { fileTypes: 'BEDPE' } })
  expect(view.pendingLaunch).toBeUndefined()
  expect(view.importWizard.selectedAssemblyName).toBeUndefined()
})

// The wizard's cached location is the reconstruction source, so the blob has
// nothing left to say by the time anything can snapshot it.
test('the launch state is never persisted', () => {
  const snap = getSnapshot(open({ assembly: 'volvox' })) as {
    launch?: unknown
  }
  expect(snap.launch).toBeUndefined()
})

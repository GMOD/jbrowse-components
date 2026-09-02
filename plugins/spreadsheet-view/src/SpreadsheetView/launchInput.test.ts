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

async function open(snap: Record<string, unknown>) {
  return (await createTestSession().launchView(
    'SpreadsheetView',
    snap,
  )) as SpreadsheetViewModel
}

// No uri, so the reaction seeds the wizard and stops: what is asserted is the
// partition, not the load.
test('a launch key written on the view object reaches the wizard', async () => {
  const view = await open({ assembly: 'volvox', fileType: 'BEDPE' })
  expect(view.importWizard.selectedAssemblyName).toBe('volvox')
  expect(view.importWizard.fileType).toBe('BEDPE')
  expect(view.launch).toBeUndefined()
  expect(warnings()).toEqual([])
})

// Nothing in this view's launch path mentions either name: the partition leaves
// a declared property on the snapshot and MST restores it. v4's applyInit read
// the four launch keys and dropped every other one in silence.
test('a declared property lands natively, named nowhere in the launch path', async () => {
  const view = await open({
    assembly: 'volvox',
    height: 700,
    hideVerticalResizeHandle: true,
  })
  expect(view.height).toBe(700)
  expect(view.hideVerticalResizeHandle).toBe(true)
})

describe('the v4 nested form', () => {
  const DEPRECATED =
    'SpreadsheetView nests its settings under "init", which is deprecated: write every setting directly on the view object.'

  test('a nested spec launches, and says the spelling is deprecated', async () => {
    const view = await open({ init: { assembly: 'volvox', fileType: 'BEDPE' } })
    expect(view.importWizard.selectedAssemblyName).toBe('volvox')
    expect(view.importWizard.fileType).toBe('BEDPE')
    expect(warnings()).toContain(DEPRECATED)
  })

  test('a declared property nested inside it lands', async () => {
    const view = await open({ init: { assembly: 'volvox', height: 700 } })
    expect(view.height).toBe(700)
    expect(warnings()).toEqual([DEPRECATED])
  })
})

// The `baseUri` a config loaded from a URL stamps beside every `uri`, the
// view's own included. It used to be reported as a typo on every such config
// and dropped, so the sheet's file resolved against the page while the tracks
// beside it resolved against the config.
test('a config-relative uri carries the config location into the wizard', async () => {
  const view = await open({
    uri: 'calls.vcf.gz',
    baseUri: 'https://host/data/config.json',
  })
  expect(view.importWizard.cachedFileLocation).toEqual({
    uri: 'calls.vcf.gz',
    baseUri: 'https://host/data/config.json',
    locationType: 'UriLocation',
  })
  expect(warnings()).toEqual([])
})

test('a key naming neither a launch key nor a property is named on attach', async () => {
  await open({ assembly: 'volvox', fileTypes: 'BEDPE' })
  expect(warnings()).toContain(
    'SpreadsheetView ignored unknown key(s): fileTypes',
  )
})

test('an unknown key is reported once', async () => {
  await open({ fileTypes: 'BEDPE' })
  expect(warnings()).toHaveLength(1)
})

// Read as work to do, the reaction seeds the wizard with an assembly nobody
// named — and `hadInit` suppresses the cached-file reload a saved session
// depends on, so the sheet comes back empty.
test('a typo alone leaves nothing pending', async () => {
  const view = await open({ fileTypes: 'BEDPE' })
  expect(view.launch).toEqual({ unknown: { fileTypes: 'BEDPE' } })
  expect(view.pendingLaunch).toBeUndefined()
  expect(view.importWizard.selectedAssemblyName).toBeUndefined()
})

// The wizard's cached location is the reconstruction source, so the blob has
// nothing left to say by the time anything can snapshot it.
test('the launch state is never persisted', async () => {
  const snap = getSnapshot(await open({ assembly: 'volvox' })) as {
    launch?: unknown
  }
  expect(snap.launch).toBeUndefined()
})

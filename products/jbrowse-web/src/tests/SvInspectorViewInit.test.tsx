import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { utilizeFetchMockForTest, volvoxGetFile } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

setup()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

jest.mock('../makeWorkerInstance', () => () => {})

// Flush any pending dynamic-import microtasks before Jest tears down the env,
// otherwise the lazy assembly adapter import started by the embedded circular
// view resolves after teardown and throws "require after Jest environment has
// been torn down".
afterEach(async () => {
  await new Promise(resolve => setTimeout(resolve, 100))
})

utilizeFetchMockForTest(volvoxGetFile)

function createSvInspectorViewWithInit(init: {
  assembly: string
  uri: string
  fileType?: string
}) {
  const { pluginManager, rootModel } = getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('SvInspectorView', { init })

  return { view, session, rootModel, pluginManager }
}

test('SvInspectorView initializes its spreadsheet from init', async () => {
  const { view } = createSvInspectorViewWithInit({
    assembly: 'volvox',
    uri: 'test_data/volvox/volvox.dup.vcf.gz',
  })

  await waitFor(
    () => {
      expect(view.spreadsheetView.spreadsheet).toBeDefined()
    },
    { timeout: 30000 },
  )

  expect(view.spreadsheetView.spreadsheet?.assemblyName).toBe('volvox')
  expect(view.init).toBeUndefined()
}, 40000)

async function loadedSvInspector() {
  const { view } = createSvInspectorViewWithInit({
    assembly: 'volvox',
    uri: 'test_data/volvox/volvox.dup.vcf.gz',
  })
  // the circle is gated on the sheet being ready, not merely on rows existing
  expect(view.showCircularView).toBe(false)
  await waitFor(
    () => {
      expect(view.circularView.displayedRegions.length).toBeGreaterThan(0)
    },
    { timeout: 30000 },
  )
  expect(view.showCircularView).toBe(true)
  return view
}

// Regression: the relevant-regions getter recomputes on every grid filter
// change, and setDisplayedRegions refits the circle. Reapplying an unchanged
// region list therefore threw away the user's pan/zoom once per keystroke in the
// quick-filter box. autoFit is the observable proxy: a refit sets it back true.
test('filtering rows leaves the circular view zoom alone', async () => {
  const view = await loadedSvInspector()
  const { spreadsheet } = view.spreadsheetView
  const before = view.features.length
  expect(before).toBeGreaterThan(0)

  view.circularView.zoomInButton()
  expect(view.circularView.autoFit).toBe(false)

  spreadsheet!.setVisibleRows({ 0: false })
  expect(view.features.length).toBe(before - 1)
  expect(view.circularView.autoFit).toBe(false)

  // and again with the toggle on, where the relevant-set really is a dependency
  // of the region binding, so only the unchanged-list check keeps the refit away
  view.setOnlyDisplayRelevantRegionsInCircularView(true)
  view.circularView.zoomInButton()
  expect(view.circularView.autoFit).toBe(false)

  spreadsheet!.setVisibleRows({ 0: false, 1: false })
  expect(view.features.length).toBe(before - 2)
  expect(view.circularView.autoFit).toBe(false)
}, 40000)

test('the relevant-regions toggle narrows the circle to refNames with data', async () => {
  const view = await loadedSvInspector()
  const all = view.circularView.displayedRegions.length

  view.setOnlyDisplayRelevantRegionsInCircularView(true)
  const narrowed: { refName: string }[] = view.circularView.displayedRegions
  expect(narrowed.length).toBeGreaterThan(0)
  expect(narrowed.length).toBeLessThanOrEqual(all)
  expect(
    narrowed.every(r => view.canonicalFeatureRefNameSet.has(r.refName)),
  ).toBe(true)

  view.setOnlyDisplayRelevantRegionsInCircularView(false)
  expect(view.circularView.displayedRegions.length).toBe(all)
}, 40000)

// Regression: the width binding used to hardcode 0.66, so any parent resize
// (window, dockview) discarded a divider drag
test('dragging the divider survives a parent resize', async () => {
  const view = await loadedSvInspector()
  view.setWidth(1000)
  const initial = view.spreadsheetView.width

  view.resizeSpreadsheetWidth(-200)
  const dragged = view.spreadsheetView.width
  expect(dragged).toBeLessThan(initial)

  view.setWidth(2000)
  expect(view.spreadsheetView.width / 2000).toBeCloseTo(dragged / 1000, 2)
}, 40000)

// Regression: SvInspector clears its own init synchronously after forwarding it
// to the child spreadsheet (which caches the file location synchronously). So a
// snapshot taken before the async load finishes carries no init on either node,
// yet still reloads via the child's persisted cachedFileLocation rather than
// stranding on the import form. This is why SvInspector can strip init
// unconditionally where the async-materializing views must keep it.
test('snapshot forwards init to child spreadsheet synchronously', () => {
  const { view } = createSvInspectorViewWithInit({
    assembly: 'volvox',
    uri: 'test_data/volvox/volvox.dup.vcf.gz',
  })

  const snap: {
    init?: unknown
    spreadsheetView: {
      init?: unknown
      importWizard: { cachedFileLocation?: unknown }
    }
  } = getSnapshot(view)
  expect(snap.init).toBeUndefined()
  expect(snap.spreadsheetView.init).toBeUndefined()
  expect(snap.spreadsheetView.importWizard.cachedFileLocation).toBeDefined()
}, 40000)

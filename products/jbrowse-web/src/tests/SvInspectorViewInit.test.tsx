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

async function createSvInspectorViewWithInit(init: {
  assembly: string
  uri?: string
  fileType?: string
}) {
  const { pluginManager, rootModel } = await getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('SvInspectorView', { init })

  return { view, session, rootModel, pluginManager }
}

test('SvInspectorView initializes its spreadsheet from init', async () => {
  const { view } = await createSvInspectorViewWithInit({
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

// The view had no `showLoading` at all, so ViewContainer published
// `data-view-phase="ready"` for the whole load and every readiness wait treated
// a spreadsheet mid-parse as settled. There is no display-level wait to fall
// back on: a spreadsheet mounts no displays.
test('SvInspectorView reports loading while its spreadsheet loads', async () => {
  const { view } = await createSvInspectorViewWithInit({
    assembly: 'volvox',
    uri: 'test_data/volvox/volvox.dup.vcf.gz',
  })

  // Both in one callback, so they are read in the same tick — the load can
  // finish between two awaits and did, when these were separate statements.
  // That this catches the loading state at all is the ImportWizard half of the
  // fix: setLoading(true) now runs before the lazy parser chunk fetch rather
  // than after it, so there is no window where the view is working and says so
  // to nobody.
  await waitFor(() => {
    expect(view.spreadsheetView.showLoading).toBe(true)
    expect(view.showLoading).toBe(true)
  })

  await waitFor(
    () => {
      expect(view.spreadsheetView.spreadsheet).toBeDefined()
    },
    { timeout: 30000 },
  )

  await waitFor(() => {
    expect(view.showLoading).toBe(false)
  })
}, 40000)

// A view sitting on its import form is finished content, not a pending state —
// the same line ViewContainer draws for every other view. Without this the
// phase would never clear for a launch that names no file.
test('SvInspectorView on the import form reports ready, not loading', async () => {
  const { view } = await createSvInspectorViewWithInit({ assembly: 'volvox' })

  expect(view.showLoading).toBe(false)
  expect(view.spreadsheetView.showLoading).toBe(false)
})

// Regression: a launch that named an assembly but no file dropped the assembly,
// and the import form fell back to whichever assembly sorted first
test('an assembly with no uri lands on the import form, on that assembly', async () => {
  const { view } = await createSvInspectorViewWithInit({ assembly: 'volvox' })

  expect(view.spreadsheetView.importWizard.selectedAssemblyName).toBe('volvox')
  expect(view.showCircularView).toBe(false)
  expect(view.spreadsheetView.spreadsheet).toBeUndefined()
  expect(view.init).toBeUndefined()
}, 40000)

async function loadedSvInspector() {
  const { view } = await createSvInspectorViewWithInit({
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

// Regression: the drag delta used to be applied to spreadsheetView.width, which
// the width binding writes back rounded and short by the divider. Each frame of
// a drag therefore lost a pixel, so the divider crept left on its own — a
// pointermove stream commits ~60 of these a second
test('a zero-distance drag leaves the divider where it is', async () => {
  const view = await loadedSvInspector()
  view.setWidth(1000)
  const before = view.spreadsheetView.width

  for (let i = 0; i < 60; i++) {
    view.resizeSpreadsheetWidth(0)
  }
  expect(view.spreadsheetView.width).toBe(before)
}, 40000)

// and the divider tracks the pointer 1:1 rather than trailing it
test('dragging moves the divider by the distance dragged', async () => {
  const view = await loadedSvInspector()
  view.setWidth(1000)
  const before = view.spreadsheetView.width

  for (let i = 0; i < 10; i++) {
    view.resizeSpreadsheetWidth(-10)
  }
  expect(view.spreadsheetView.width).toBe(before - 100)
}, 40000)

// Regression: SvInspector clears its own init synchronously after forwarding it
// to the child spreadsheet (which caches the file location synchronously). So a
// snapshot taken before the async load finishes carries no init on either node,
// yet still reloads via the child's persisted cachedFileLocation rather than
// stranding on the import form. This is why SvInspector can strip init
// unconditionally where the async-materializing views must keep it.
test('snapshot forwards init to child spreadsheet synchronously', async () => {
  const { view } = await createSvInspectorViewWithInit({
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

// Regression: the region binding was gated on circularView.initialized, which
// asks whether the assembly named by the regions the circle ALREADY holds has
// loaded. A saved session whose persisted regions name an assembly the config no
// longer has therefore pinned the circle to them: never initialized, so never
// corrected, and showLoading true forever with no error to render.
test('the circle recovers from regions naming an assembly that is gone', async () => {
  const view = await loadedSvInspector()
  const good = view.circularView.displayedRegions
  expect(good.length).toBeGreaterThan(0)

  // an assembly the config doesn't have is exactly what makes
  // circularView.initialized read false, since that getter resolves the
  // assemblies named by these regions. The binding corrects the list rather than
  // waiting on them, so this lands within the setter's own action
  view.circularView.setDisplayedRegions([
    { refName: 'ctgA', start: 0, end: 100, assemblyName: 'assembly-that-left' },
  ])

  expect(view.circularView.displayedRegions).toEqual(good)
  expect(view.circularView.initialized).toBe(true)
}, 40000)

// Regression: the whole circularView node was stripped from the snapshot, so a
// reload reset the circle even though the circular view persists its own pan and
// zoom on purpose. Only `tracks` can't be persisted, because the chord track
// this view generates carries every visible feature inline in its configuration
test('the snapshot keeps the circle but not its generated chord track', async () => {
  const view = await loadedSvInspector()
  await waitFor(
    () => {
      expect(view.circularView.tracks.length).toBe(1)
    },
    { timeout: 30000 },
  )
  view.circularView.zoomInButton()
  const { bpPerPx } = view.circularView

  const snap: {
    circularView: {
      tracks?: unknown[]
      bpPerPx?: number
      autoFit?: boolean
      displayedRegions?: unknown[]
      disableImportForm?: boolean
    }
  } = getSnapshot(view)

  expect(snap.circularView.tracks).toBeUndefined()
  expect(snap.circularView.bpPerPx).toBe(bpPerPx)
  // the regions have to persist alongside the zoom: setDisplayedRegions refits,
  // so a circle that rebuilt its region list on load would refit away the zoom
  expect(snap.circularView.displayedRegions?.length).toBeGreaterThan(0)
  expect(snap.circularView.autoFit).toBe(false)
  // and the flags that make it an embedded circle rather than a standalone one,
  // which used to come back from the default factory
  expect(snap.circularView.disableImportForm).toBe(true)
}, 40000)

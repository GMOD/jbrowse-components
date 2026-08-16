import { types } from '@jbrowse/mobx-state-tree'

import stateModelFactory from './SpreadsheetViewModel.ts'

// minimal session stub: getSession walks up for a node with rpcManager +
// configuration, and applyInit routes load errors to notifyError
function makeSession() {
  const SpreadsheetView = stateModelFactory()
  const Session = types
    .model({
      rpcManager: types.frozen(),
      configuration: types.frozen(),
      view: types.maybe(SpreadsheetView),
    })
    .actions(self => ({
      setView(view: ReturnType<typeof SpreadsheetView.create>) {
        self.view = view
        return self.view
      },
      closeView() {
        self.view = undefined
      },
      notifyError() {},
    }))
  return { Session, SpreadsheetView }
}

beforeEach(() => {
  // the stubbed file load fails (no real fetch); silence its diagnostics
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

test('setInit applies the import exactly once', () => {
  const { Session, SpreadsheetView } = makeSession()
  const session = Session.create({ rpcManager: {}, configuration: {} })
  const model = session.setView(
    SpreadsheetView.create({ type: 'SpreadsheetView' }),
  )

  model.setInit({ assembly: 'volvox', uri: 'test.vcf' })

  // the reaction consumes init synchronously and points the wizard at the file
  expect(model.init).toBeUndefined()
  expect(model.importWizard.fileSource).toMatchObject({ uri: 'test.vcf' })
})

// Regression: a launch that named an assembly but no file dropped the assembly
// on the floor, and the import form fell back to assemblyNames[0]
test('an init with no uri seeds the import form instead of loading', () => {
  const { Session, SpreadsheetView } = makeSession()
  const session = Session.create({ rpcManager: {}, configuration: {} })
  const model = session.setView(
    SpreadsheetView.create({ type: 'SpreadsheetView' }),
  )

  model.setInit({ assembly: 'volvox', fileType: 'BEDPE' })

  expect(model.importWizard.selectedAssemblyName).toBe('volvox')
  expect(model.importWizard.fileType).toBe('BEDPE')
  // nothing to open, so no source, no cache, and we stay on the import form
  expect(model.importWizard.fileSource).toBeUndefined()
  expect(model.importWizard.cachedFileLocation).toBeUndefined()
  expect(model.spreadsheet).toBeUndefined()
})

// an explicit fileType is the caller overriding what the filename implies
test('an explicit fileType wins over the type inferred from the uri', () => {
  const { Session, SpreadsheetView } = makeSession()
  const session = Session.create({ rpcManager: {}, configuration: {} })
  const model = session.setView(
    SpreadsheetView.create({ type: 'SpreadsheetView' }),
  )

  model.setInit({ assembly: 'volvox', uri: 'test.vcf', fileType: 'BEDPE' })
  expect(model.importWizard.fileType).toBe('BEDPE')
})

test('reloading the same file preserves column visibility and SV-type filter', () => {
  const { Session, SpreadsheetView } = makeSession()
  const session = Session.create({ rpcManager: {}, configuration: {} })
  const model = session.setView(
    SpreadsheetView.create({ type: 'SpreadsheetView' }),
  )

  const columns = [{ name: 'CHROM' }, { name: 'INFO.SVTYPE' }]
  model.displaySpreadsheet({ columns, rowSet: { rows: [] } })
  model.spreadsheet!.setVisibleColumns({ 'INFO.SVTYPE': false })
  model.spreadsheet!.setSvTypeFilter('DEL')

  // a re-fetch supplies only columns/rowSet (no view state); same columns ⇒
  // carry over the user's choices
  model.displaySpreadsheet({ columns, rowSet: { rows: [] } })
  expect(model.spreadsheet!.visibleColumns).toEqual({ 'INFO.SVTYPE': false })
  expect(model.spreadsheet!.svTypeFilter).toBe('DEL')

  // a genuinely different file (different columns) starts clean
  model.spreadsheet!.setVisibleColumns({ CHROM: false })
  model.displaySpreadsheet({
    columns: [{ name: 'other' }],
    rowSet: { rows: [] },
  })
  expect(model.spreadsheet!.visibleColumns).toEqual({})
  expect(model.spreadsheet!.svTypeFilter).toBeUndefined()
})

test('returning to the import form drops the cached location', () => {
  const { Session, SpreadsheetView } = makeSession()
  const session = Session.create({ rpcManager: {}, configuration: {} })
  const model = session.setView(
    SpreadsheetView.create({ type: 'SpreadsheetView' }),
  )

  model.importWizard.setCachedFileLocation({
    uri: 'test.vcf',
    locationType: 'UriLocation',
  })
  model.displaySpreadsheet({
    columns: [{ name: 'CHROM' }],
    rowSet: { rows: [] },
  })

  // leaving the cache behind makes afterAttach re-fetch the dismissed file on
  // the next session load
  model.returnToImportForm()
  expect(model.spreadsheet).toBeUndefined()
  expect(model.importWizard.cachedFileLocation).toBeUndefined()
})

// MST's default liveliness checking is "warn", so writing to a view the user
// closed mid-load does not throw — it logs three of these per write and drops
// the write, which is how this went unnoticed. The file is fetched and parsed
// in full either way, for a view that is gone
test('closing the view mid-load stops writing to the dead node', async () => {
  const { Session, SpreadsheetView } = makeSession()
  const session = Session.create({ rpcManager: {}, configuration: {} })
  const model = session.setView(
    SpreadsheetView.create({ type: 'SpreadsheetView' }),
  )
  model.importWizard.setFileSource({
    uri: 'test.vcf',
    locationType: 'UriLocation',
  })

  const warn = jest.spyOn(console, 'warn')
  const load = model.loadSpreadsheet('volvox')
  session.closeView()
  await load

  const liveliness = warn.mock.calls
    .map(c => String(c[0]))
    .filter(m => m.includes('no longer part of a state tree'))
  expect(liveliness).toEqual([])
})

test('width churn does not re-trigger the load (reaction tracks init, not width)', () => {
  const { Session, SpreadsheetView } = makeSession()
  const session = Session.create({ rpcManager: {}, configuration: {} })
  const model = session.setView(
    SpreadsheetView.create({ type: 'SpreadsheetView' }),
  )

  model.setInit({ assembly: 'volvox', uri: 'test.vcf' })
  // each applyInit run calls setFileSource with a fresh object, so fileSource
  // identity is a proxy for "the load re-ran". Under the old width-reactive
  // autorun this changed on every resize (duplicate import); the reaction
  // tracks only `init`, so width churn leaves it untouched.
  const applied = model.importWizard.fileSource
  model.setWidth(801)
  model.setWidth(802)
  model.setWidth(803)
  expect(model.importWizard.fileSource).toBe(applied)
})

// The imported file becomes a session track so the views a row drills down into
// hold the records the row came from — before this they opened empty.
describe('the imported file as a track', () => {
  // the adapter registry, stubbed: what is under test is which adapter and
  // track type each format asks for, not what key that adapter declares — so
  // the stub answers with a distinctive one and the assertions read the
  // location back out of it
  const pluginManager = {
    getAdapterType: (name: string) => ({ locationKey: `${name}Location` }),
  }

  function sessionWithTracks() {
    const SpreadsheetView = stateModelFactory()
    const added: Record<string, unknown>[] = []
    const Session = types
      .model({
        rpcManager: types.frozen(),
        configuration: types.frozen(),
        // `existingTrackId` sweeps these looking for a track already showing
        // the file; nothing here has one
        tracks: types.frozen<unknown[]>(),
        view: types.maybe(SpreadsheetView),
      })
      .actions(self => ({
        setView(view: ReturnType<typeof SpreadsheetView.create>) {
          self.view = view
          return self.view
        },
        addSessionTrackConf(conf: Record<string, unknown>) {
          added.push(conf)
          return conf
        },
        notifyError() {},
      }))
    const session = Session.create(
      { rpcManager: {}, configuration: {}, tracks: [] },
      { pluginManager },
    )
    const model = session.setView(
      SpreadsheetView.create({ type: 'SpreadsheetView' }),
    )
    return { model, added }
  }

  function importedTrack(uri: string) {
    const { model, added } = sessionWithTracks()
    model.importWizard.setFileSource({ uri, locationType: 'UriLocation' })
    model.registerImportedTrack('hg38')
    return added
  }

  test('a VCF import registers a VariantTrack on the plain adapter', () => {
    const added = importedTrack('https://example.com/calls.vcf.gz')
    expect(added).toHaveLength(1)
    expect(added[0]).toMatchObject({
      type: 'VariantTrack',
      // the basename, which is what a track selector row has room for
      name: 'calls.vcf.gz',
      assemblyNames: ['hg38'],
      // NOT VcfTabixAdapter, which is what guessing off the filename gives: it
      // needs an index the sheet never used, and the C-GIAB benchmark VCF the
      // SV tutorial is built on has none
      adapter: {
        type: 'VcfAdapter',
        VcfAdapterLocation: { uri: 'https://example.com/calls.vcf.gz' },
      },
    })
  })

  test('each format asks for the adapter and track type it needs', () => {
    expect(importedTrack('https://example.com/pairs.bedpe')[0]).toMatchObject({
      type: 'VariantTrack',
      adapter: { type: 'BedpeAdapter' },
    })
    expect(importedTrack('https://example.com/regions.bed')[0]).toMatchObject({
      type: 'FeatureTrack',
      adapter: { type: 'BedAdapter' },
    })
  })
})

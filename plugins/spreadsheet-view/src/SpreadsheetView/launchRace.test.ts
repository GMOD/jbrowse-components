import { types } from '@jbrowse/mobx-state-tree'

import stateModelFactory from './SpreadsheetViewModel.ts'

// Each uri's fetch is released by hand, so the slow-then-fast ordering the race
// needs is stated rather than timed.
const mockGates = new Map<string, () => void>()
const mockBodies = new Map<string, string>()

jest.mock('@jbrowse/core/util/io', () => ({
  openLocation: (loc: { uri: string }) => ({
    uri: loc.uri,
    stat: () => Promise.resolve({ size: 10 }),
  }),
}))

jest.mock('@jbrowse/core/util', () => {
  const actual = jest.requireActual('@jbrowse/core/util')
  return {
    ...actual,
    fetchAndMaybeUnzip: (fh: { uri: string }) =>
      new Promise(resolve => {
        mockGates.set(fh.uri, () => {
          resolve(Buffer.from(mockBodies.get(fh.uri) ?? ''))
        })
      }),
  }
})

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
      notifyError() {},
      notify() {},
    }))
  return { Session, SpreadsheetView }
}

const bed = (name: string) => `chr1\t1\t2\t${name}\n`

beforeEach(() => {
  mockGates.clear()
  mockBodies.clear()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

const flush = async () => {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve()
  }
}

// Two launches of one view, back to back. They shared one import wizard and
// ran at once, so whichever file came back last was the one on screen — the
// older of the two, if it was the slower. The launcher drains them instead.
test('a second launch supersedes the first rather than racing it', async () => {
  const { Session, SpreadsheetView } = makeSession()
  const session = Session.create({ rpcManager: {}, configuration: {} })
  const model = session.setView(
    SpreadsheetView.create({ type: 'SpreadsheetView' }),
  )

  mockBodies.set('old.bed', bed('OLD'))
  mockBodies.set('new.bed', bed('NEW'))

  model.setLaunch({ assembly: 'volvox', uri: 'old.bed', fileType: 'BED' })
  await flush()
  model.setLaunch({ assembly: 'volvox', uri: 'new.bed', fileType: 'BED' })
  await flush()

  // one at a time: the second has not been handed to the wizard yet
  expect([...mockGates.keys()]).toEqual(['old.bed'])

  mockGates.get('old.bed')!()
  await flush()
  expect([...mockGates.keys()]).toEqual(['old.bed', 'new.bed'])

  mockGates.get('new.bed')!()
  await flush()

  // the file the user asked for last is the one showing
  expect(JSON.stringify(model.spreadsheet?.rowSet)).toContain('NEW')
  expect(JSON.stringify(model.spreadsheet?.rowSet)).not.toContain('OLD')
  expect(model.importWizard.loading).toBe(false)
})

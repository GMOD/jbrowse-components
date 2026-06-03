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

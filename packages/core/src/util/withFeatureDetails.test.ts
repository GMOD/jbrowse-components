import { withFeatureDetails } from './withFeatureDetails.ts'

const mockNotifyError = jest.fn()

jest.mock('@jbrowse/mobx-state-tree', () => ({
  ...jest.requireActual('@jbrowse/mobx-state-tree'),
  isAlive: () => true,
}))
jest.mock('./sessionServices.ts', () => ({
  getNotificationSink: () => ({ notifyError: mockNotifyError }),
}))

beforeEach(() => {
  mockNotifyError.mockClear()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

test('an aborted fetch stays silent', async () => {
  const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
  await withFeatureDetails({}, () => Promise.reject(abort), jest.fn())
  expect(mockNotifyError).not.toHaveBeenCalled()
})

test('another error is reported', async () => {
  await withFeatureDetails(
    {},
    () => Promise.reject(new Error('boom')),
    jest.fn(),
  )
  expect(mockNotifyError).toHaveBeenCalled()
})

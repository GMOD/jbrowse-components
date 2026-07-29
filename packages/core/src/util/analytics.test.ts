import { writeAWSAnalytics, writeGAAnalytics } from './analytics.ts'

// A rejected analytics promise nobody catches trips the webpack-dev-server
// overlay (it listens for unhandledrejection) with a full-screen error in dev,
// so both writers absorb their own failures. Every call site floats them.
const rootModel = {
  jbrowse: {
    tracks: [],
    assemblies: [],
    plugins: [],
    configuration: {},
  },
  version: '0.0.0-test',
}

let warn: jest.SpyInstance

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
})

test('writeAWSAnalytics resolves when the ping fails', async () => {
  fetchMock.mockRejectOnce(new Error('blocked by client'))

  await expect(
    writeAWSAnalytics(rootModel, Date.now(), undefined),
  ).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalledWith(
    'Failed to write analytics to AWS.',
    expect.any(Error),
  )
})

test('writeAWSAnalytics resolves when reading the model throws', async () => {
  const dead = {
    ...rootModel,
    get jbrowse(): never {
      throw new Error('no longer part of a state tree')
    },
  }

  await expect(writeAWSAnalytics(dead, Date.now())).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalled()
})

test('writeGAAnalytics injects the tracker script', async () => {
  await writeGAAnalytics(rootModel, Date.now() - 1000)

  const script = document.head.lastElementChild
  expect(script?.tagName).toBe('SCRIPT')
  expect(script?.innerHTML).toContain('jbrowseTracker')
  expect(warn).not.toHaveBeenCalled()
})

test('writeGAAnalytics resolves when reading the model throws', async () => {
  const dead = {
    ...rootModel,
    get jbrowse(): never {
      throw new Error('no longer part of a state tree')
    },
  }

  await expect(writeGAAnalytics(dead, Date.now())).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalledWith(
    'Failed to write analytics to GA.',
    expect.any(Error),
  )
})

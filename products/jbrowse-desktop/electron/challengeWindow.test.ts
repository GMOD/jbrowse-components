/**
 * @jest-environment node
 *
 * The BLAT CAPTCHA window against a fake BrowserWindow whose partition holds a
 * cookie jar, since the window's only job is to watch that jar.
 */
import { createChallengeWindow } from './window.ts'

const CHALLENGE_URL = 'https://genome.ucsc.edu/'

interface Cookie {
  name: string
  value: string
}
const mockJar: Cookie[] = []
const mockCookies = {
  get: jest.fn(async ({ name }: { name: string }) =>
    mockJar.filter(c => c.name === name),
  ),
  remove: jest.fn(async (_url: string, name: string) => {
    for (let i = mockJar.length - 1; i >= 0; i--) {
      if (mockJar[i]!.name === name) {
        mockJar.splice(i, 1)
      }
    }
  }),
}

jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => {
    const listeners = new Map<string, () => void>()
    let destroyed = false
    return {
      webContents: {
        session: { cookies: mockCookies },
        setWindowOpenHandler: () => {},
        on: () => {},
      },
      loadURL: jest.fn(async () => {}),
      on: (event: string, listener: () => void) => {
        listeners.set(event, listener)
      },
      isDestroyed: () => destroyed,
      close: () => {
        destroyed = true
        listeners.get('closed')?.()
      },
    }
  }),
  Menu: {},
  app: {},
  clipboard: {},
  dialog: {},
  shell: {},
}))

beforeEach(() => {
  jest.useFakeTimers()
  mockJar.length = 0
})

afterEach(() => {
  jest.useRealTimers()
})

// The window opens because the server challenged a request, so a clearance
// already in the jar is one it refused; the poll used to find it within a
// second and close the window before the user could solve anything.
test('a clearance already in the jar does not count as a solve', async () => {
  mockJar.push({ name: 'cf_clearance', value: 'refused' })
  let solved: boolean | undefined
  void createChallengeWindow(CHALLENGE_URL).then(ok => {
    solved = ok
  })

  await jest.advanceTimersByTimeAsync(3000)
  expect(solved).toBeUndefined()

  mockJar.push({ name: 'cf_clearance', value: 'fresh' })
  await jest.advanceTimersByTimeAsync(1000)
  expect(solved).toBe(true)
})

import { renderHook, waitFor } from '@testing-library/react'

import { onIpc } from '../ipc.ts'
import { useLaunchTarget } from './useLaunchTarget.ts'

import type { LaunchTarget } from '../../electron/ipc/channelTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

// the real useIpc runs on top of this, so the channel name is part of what the
// tests below check
jest.mock('../ipc.ts', () => ({ onIpc: jest.fn() }))

const mockOnIpc = jest.mocked(onIpc)

const link: LaunchTarget = {
  type: 'link',
  url: 'https://jbrowse.org/?session=spec-{}',
}
const file: LaunchTarget = { type: 'file', path: '/home/me/my.jbrowse' }
const pluginManager = { id: 'pm' } as unknown as PluginManager

function setup(overrides: Partial<Parameters<typeof useLaunchTarget>[0]> = {}) {
  // the swap under test is the real one's contract, not its behavior: run the
  // loader it is handed and resolve
  const swap = jest.fn(async (load: () => Promise<PluginManager>) => {
    await load()
  })
  const load = jest.fn(async (_target: LaunchTarget) => pluginManager)
  const onError = jest.fn()

  let deliver!: (target: LaunchTarget) => void
  mockOnIpc.mockImplementation((channel, listener) => {
    expect(channel).toBe('openLaunchTarget')
    deliver = listener
    return () => {}
  })

  const deps = { swap, load, onError, ...overrides }
  renderHook(() => {
    useLaunchTarget(deps)
  })
  return {
    ...deps,
    swap,
    deliver: (t: LaunchTarget) => {
      deliver(t)
    },
  }
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

test('does not swap until a target is pushed', () => {
  expect(setup().swap).not.toHaveBeenCalled()
})

test('swaps to the pushed link', async () => {
  const { deliver, load } = setup()

  deliver(link)

  await waitFor(() => {
    expect(load).toHaveBeenCalledWith(link)
  })
})

test('swaps to the pushed file', async () => {
  const { deliver, load } = setup()

  deliver(file)

  await waitFor(() => {
    expect(load).toHaveBeenCalledWith(file)
  })
})

// A push has nobody to return a rejection to, so this is the one swap trigger
// that has to report failures itself — an unhandled rejection is all the user
// would otherwise get.
test('reports a failed swap against the target that caused it', async () => {
  const error = new Error('config 404')
  const { deliver, onError } = setup({
    swap: jest.fn().mockRejectedValue(error),
  })

  deliver(file)

  await waitFor(() => {
    expect(onError).toHaveBeenCalledWith(error, file)
  })
})

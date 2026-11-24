import { act, render, screen } from '@testing-library/react'

import { useMcpRequests } from '../mcp/useMcpRequests.ts'
import Loader from './Loader.tsx'
import { destroyPluginManager, loadPluginManager } from './StartScreen/util.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('@jbrowse/render-core/gpuDevice', () => ({
  setGpuOverride: jest.fn(),
}))
jest.mock('@jbrowse/render-core/graphicsCapabilities', () => ({
  prewarmGraphics: jest.fn(),
}))
jest.mock('../ipc.ts', () => ({
  invokeIpc: jest.fn().mockResolvedValue(undefined),
  onIpc: jest.fn(() => () => {}),
}))
jest.mock('../mcp/useMcpRequests.ts', () => ({ useMcpRequests: jest.fn() }))
jest.mock('./useLaunchTarget.ts', () => ({ useLaunchTarget: jest.fn() }))
jest.mock('./LazyJBrowse.ts', () => ({
  LazyJBrowse: ({ pluginManager }: { pluginManager: { id: string } }) => (
    <div>{`session ${pluginManager.id}`}</div>
  ),
}))
jest.mock('./StartScreen/util.tsx', () => ({
  destroyPluginManager: jest.fn(),
  loadPluginManager: jest.fn(),
  openSpecLink: jest.fn(),
}))

let setPluginManager: (pm: PluginManager) => void = () => {}
jest.mock('./StartScreen/StartScreen.tsx', () => ({
  __esModule: true,
  default: (props: { setPluginManager: (pm: PluginManager) => void }) => {
    setPluginManager = props.setPluginManager
    return <div>start screen</div>
  },
}))

function fakePluginManager(id: string) {
  return {
    id,
    rootModel: {
      session: {},
      setOpenNewSessionCallback: jest.fn(),
      setOpenLinkCallback: jest.fn(),
      setReturnToStartScreenCallback: jest.fn(),
      flushSession: jest.fn(),
    },
  } as unknown as PluginManager
}

test('a start-screen launch that lands after a session opened is dropped', async () => {
  render(<Loader />)
  await screen.findByText('start screen')
  const recent = fakePluginManager('recent')
  const hub = fakePluginManager('hub')

  act(() => {
    setPluginManager(recent)
  })
  await screen.findByText('session recent')
  act(() => {
    setPluginManager(hub)
  })

  expect(screen.getByText('session recent')).toBeTruthy()
  expect(jest.mocked(destroyPluginManager).mock.calls).toEqual([[hub]])
})

describe('what the MCP bridge is told about an open it asked for', () => {
  function lastAnnouncement() {
    const [, phase, , request] =
      jest.mocked(useMcpRequests).mock.calls.at(-1) ?? []
    return { phase, request }
  }

  beforeEach(() => {
    window.history.replaceState(
      null,
      '',
      '/?config=%2Fhome%2Fme%2Fmy.jbrowse&request=mcp-open-1',
    )
  })

  afterEach(() => {
    jest.mocked(loadPluginManager).mockReset()
    jest.restoreAllMocks()
  })

  test('the session it loaded answers with its request', async () => {
    jest
      .mocked(loadPluginManager)
      .mockResolvedValue(fakePluginManager('opened'))
    render(<Loader />)
    await screen.findByText('session opened')

    expect(lastAnnouncement()).toEqual({
      phase: 'session',
      request: 'mcp-open-1',
    })
  })

  test('the start screen it fell back to answers with its request', async () => {
    jest.mocked(loadPluginManager).mockRejectedValue(new Error('no such file'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    render(<Loader />)
    await screen.findByText('start screen')

    expect(lastAnnouncement()).toEqual({
      phase: 'startScreen',
      request: 'mcp-open-1',
    })
  })
})

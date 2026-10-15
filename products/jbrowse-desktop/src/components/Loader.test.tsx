import { act, render, screen } from '@testing-library/react'

import Loader from './Loader.tsx'
import { destroyPluginManager } from './StartScreen/util.tsx'

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

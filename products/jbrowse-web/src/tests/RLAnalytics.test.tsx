import { LocalFile } from 'generic-filehandle2'

import RLAnalyticsPlugin from '@jbrowse/plugin-rl-analytics'

import { handleRequest } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

setup()

console.warn = jest.fn()
console.error = jest.fn()

const getFile = (url: string) => {
  const cleanUrl = url.replace(/http:\/\/localhost\//, '')
  const filePath = cleanUrl.startsWith('test_data')
    ? cleanUrl
    : `test_data/volvox/${cleanUrl}`
  return new LocalFile(require.resolve(`../../${filePath}`))
}

jest.mock('../makeWorkerInstance', () => () => {})

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  return `${url}`.includes('jb2=true')
    ? new Response('{}')
    : handleRequest(() => getFile(`${url}`), args)
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

function flushMicrotasks() {
  return new Promise<void>(resolve => {
    setTimeout(resolve, 100)
  })
}

function getRLPlugin(pluginManager: { plugins: { name: string }[] }) {
  return pluginManager.plugins.find(
    p => p.name === 'RLAnalyticsPlugin',
  ) as InstanceType<typeof RLAnalyticsPlugin>
}

test('collects actions and exports valid JSONL with volvox data', async () => {
  // Note: getPluginManager calls setDefaultSession + configure —
  // do NOT call setDefaultSession again or the onPatch listener detaches
  const { pluginManager, rootModel } = getPluginManager()
  const view = rootModel.session!.views[0]!

  const rlPlugin = getRLPlugin(pluginManager)
  const exportManager = rlPlugin.getExportManager()!
  const patchListener = rlPlugin.getPatchListener()!

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lgv = view as any
  lgv.setWidth(800)

  // Trigger navigation actions that generate MST patches
  const originalBpPerPx = lgv.bpPerPx
  lgv.zoomTo(originalBpPerPx / 2) // zoom in → ZOOM_IN
  lgv.horizontalScroll(500) // pan right → PAN_RIGHT
  lgv.horizontalScroll(-200) // pan left → PAN_LEFT
  lgv.zoomTo(originalBpPerPx) // zoom out → ZOOM_OUT

  // Verify patches were classified and buffered synchronously
  expect(patchListener.buffer.length).toBeGreaterThan(0)

  // Wait for queueMicrotask callbacks to record episodes
  await flushMicrotasks()

  // Export and validate JSONL
  const jsonl = exportManager.getJSONL()
  const lines = jsonl.split('\n').filter(Boolean)
  expect(lines.length).toBeGreaterThan(0)

  const steps = lines.map(line => JSON.parse(line))
  for (const step of steps) {
    expect(step).toHaveProperty('episode_id')
    expect(step).toHaveProperty('observation')
    expect(step).toHaveProperty('action')
    expect(typeof step.reward).toBe('number')
    expect(typeof step.terminated).toBe('boolean')

    const obs = step.observation
    expect(typeof obs.bpPerPx).toBe('number')
    expect(obs.bpPerPx).toBeGreaterThan(0)
    expect(obs).toHaveProperty('refName')
  }

  // Verify multiple action types were captured
  const actionTypes = new Set(steps.map((s: { action: string }) => s.action))
  expect(actionTypes.size).toBeGreaterThanOrEqual(2)
})

test('episode manager tracks episodes with correct structure', async () => {
  const { pluginManager, rootModel } = getPluginManager()
  const view = rootModel.session!.views[0]!

  const episodeManager = getRLPlugin(pluginManager).getEpisodeManager()!

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lgv = view as any
  lgv.setWidth(800)
  lgv.zoomTo(lgv.bpPerPx / 2)
  lgv.horizontalScroll(100)

  await flushMicrotasks()

  const episodes = episodeManager.getAllEpisodes()
  expect(episodes.length).toBeGreaterThanOrEqual(1)

  const episode = episodes[0]!
  expect(episode.steps.length).toBeGreaterThanOrEqual(1)
  expect(episode.outcome).toBe('in_progress')
  expect(episode.id).toBeTruthy()

  // Verify step structure
  const step = episode.steps[0]!
  expect(step.state).toHaveProperty('bpPerPx')
  expect(step.nextState).toHaveProperty('bpPerPx')
  expect(typeof step.reward).toBe('number')
  expect(typeof step.terminal).toBe('boolean')
})

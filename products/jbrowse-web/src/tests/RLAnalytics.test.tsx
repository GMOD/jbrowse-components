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
    setTimeout(resolve, 700) // must exceed 500ms debounce window
  })
}

function getRLPlugin(pluginManager: { plugins: { name: string }[] }) {
  return pluginManager.plugins.find(
    p => p.name === 'RLAnalyticsPlugin',
  ) as InstanceType<typeof RLAnalyticsPlugin>
}

test('MST onAction fires for view actions', () => {
  const { onAction } = require('@jbrowse/mobx-state-tree')
  const { rootModel } = getPluginManager()
  const session = rootModel.session!
  const view = session.views[0]!

  const calls: string[] = []
  const disposer = onAction(session, (call: { name: string }) => {
    calls.push(call.name)
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lgv = view as any
  lgv.setWidth(800)
  lgv.zoomTo(lgv.bpPerPx / 2)
  lgv.horizontalScroll(100)

  disposer()
  expect(calls.length).toBeGreaterThan(0)
})

test('collects actions and exports valid JSONL with enriched state', async () => {
  const { pluginManager, rootModel } = getPluginManager()
  const view = rootModel.session!.views[0]!

  const rlPlugin = getRLPlugin(pluginManager)
  const exportManager = rlPlugin.getExportManager()!
  const actionListener = rlPlugin.getActionListener()!

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lgv = view as any
  lgv.setWidth(800)

  const originalBpPerPx = lgv.bpPerPx
  lgv.zoomTo(originalBpPerPx / 2)
  lgv.horizontalScroll(500)
  lgv.horizontalScroll(-200)
  lgv.zoomTo(originalBpPerPx)

  expect(actionListener.buffer.length).toBeGreaterThan(0)

  await flushMicrotasks()

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
    // New enriched fields
    expect(obs).toHaveProperty('zoomLevel')
    expect(['genome', 'region', 'gene', 'sequence', 'basepair']).toContain(
      obs.zoomLevel,
    )
    expect(obs).toHaveProperty('numTracks')
    expect(obs).toHaveProperty('activeTracks')
    expect(obs).toHaveProperty('sessionDurationMs')
    expect(obs).toHaveProperty('totalActionsThisSession')
  }

  const actionTypes = new Set(steps.map((s: { action: string }) => s.action))
  expect(actionTypes.size).toBeGreaterThanOrEqual(1)
})

test('episode manager caches prevState correctly', async () => {
  const { pluginManager, rootModel } = getPluginManager()
  const view = rootModel.session!.views[0]!

  const episodeManager = getRLPlugin(pluginManager).getEpisodeManager()!

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lgv = view as any
  lgv.setWidth(800)
  lgv.horizontalScroll(500)
  lgv.horizontalScroll(-200)
  lgv.horizontalScroll(300)

  await flushMicrotasks()

  const episodes = episodeManager.getAllEpisodes()
  expect(episodes.length).toBeGreaterThanOrEqual(1)

  const episode = episodes[0]!
  expect(episode.steps.length).toBeGreaterThanOrEqual(1)

  // With prevState caching, consecutive steps should have
  // prevState matching the previous step's nextState
  if (episode.steps.length >= 2) {
    const step1 = episode.steps[0]!
    const step2 = episode.steps[1]!
    expect(step2.state.bpPerPx).toBe(step1.nextState.bpPerPx)
    expect(step2.state.offsetPx).toBe(step1.nextState.offsetPx)
  }
})

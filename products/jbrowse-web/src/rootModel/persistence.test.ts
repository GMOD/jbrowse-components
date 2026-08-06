import PluginManager from '@jbrowse/core/PluginManager'
import { destroy, isAlive } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'
import sessionModelFactory from '../sessionModel/index.ts'
import { staleSessionIds } from './persistence.ts'
import rootModelFactory from './rootModel.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// The autosave autorun is debounced, so nothing it writes lands during a test
// that doesn't wait. That is exactly the window under test: what a tab closed
// mid-debounce leaves behind for the next load to restore.
//
// Every root has to be destroyed, and before sessionStorage is cleared: a live
// one's debounced autorun fires ~400ms later and writes into whichever test is
// running by then.
type Root = ReturnType<ReturnType<typeof rootModelFactory>['create']>

const roots: Root[] = []

function makeRoot() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const root = rootModelFactory({ pluginManager, sessionModelFactory }).create({
    jbrowse: {
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
  root.setSession({ name: 'testSession' })
  roots.push(root)
  return root
}

function storedSessionName() {
  const raw = sessionStorage.getItem('current')
  return raw === null
    ? undefined
    : (JSON.parse(raw) as { session: { name: string } }).session.name
}

function unload() {
  window.dispatchEvent(new Event('beforeunload'))
}

afterEach(() => {
  for (const root of roots) {
    if (isAlive(root)) {
      destroy(root)
    }
  }
  roots.length = 0
  sessionStorage.clear()
  localStorage.clear()
})

test('unload writes the session even though the autosave is still debounced', () => {
  makeRoot()
  // nothing yet: the debounce has not elapsed
  expect(storedSessionName()).toBeUndefined()

  unload()

  expect(storedSessionName()).toBe('testSession')
})

test('unload writes the latest name, not the one from the last debounce tick', () => {
  const root = makeRoot()
  unload()
  expect(storedSessionName()).toBe('testSession')

  root.session!.setName('renamed since')
  unload()

  expect(storedSessionName()).toBe('renamed since')
})

test('a destroyed root model stops writing on unload', () => {
  const root = makeRoot()
  destroy(root)

  unload()

  // reloadPluginManager builds a replacement while the old model is torn down;
  // a listener left behind would write the dead model's session over the live one
  expect(storedSessionName()).toBeUndefined()
})

test('a replacement root model is the one that wins the unload write', () => {
  const first = makeRoot()
  first.session!.setName('old session')
  destroy(first)

  const second = makeRoot()
  second.session!.setName('new session')

  unload()

  expect(storedSessionName()).toBe('new session')
})

describe('staleSessionIds', () => {
  function meta(id: string, daysAgo: number, favorite = false) {
    return {
      id,
      name: id,
      configPath: '',
      favorite,
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date(Date.UTC(2024, 0, 100 - daysAgo)),
    }
  }

  // 100 non-favorites is the cap, so a list at or under it loses nothing
  function fill(n: number) {
    return Array.from({ length: n }, (_, i) => meta(`s${i}`, i))
  }

  it('keeps everything while under the cap', () => {
    expect(staleSessionIds(fill(100), undefined)).toEqual([])
  })

  it('drops only the oldest past the cap', () => {
    const ids = staleSessionIds(fill(103), undefined)
    expect(ids).toEqual(['s100', 's101', 's102'])
  })

  // favorites are what a user asked to keep, so they are not candidates at all
  // — and crucially they do not occupy the 100 slots either, or starring a
  // hundred sessions would silently start evicting the recent ones
  it('never drops a favorite, and favorites do not consume the cap', () => {
    const list = [...fill(103), meta('fav', 999, true)]
    expect(staleSessionIds(list, undefined)).toEqual(['s100', 's101', 's102'])
  })

  // the open session is rewritten every autosave tick, so deleting it only
  // makes it vanish until the next edit puts it back — with its star reset
  it('never drops the active session, however old', () => {
    const list = [...fill(103), meta('active', 999)]
    expect(staleSessionIds(list, 'active')).toEqual(['s100', 's101', 's102'])
  })

  // rows written before updatedAt existed fall back to createdAt via
  // sessionLastUsed; reading updatedAt directly would sort them as NaN
  it('ranks legacy rows with no updatedAt by createdAt', () => {
    const legacy = {
      id: 'legacy',
      name: 'legacy',
      configPath: '',
      favorite: false,
      createdAt: new Date(Date.UTC(2024, 0, 1)),
    }
    const recent = meta('recent', 0)
    const list = [legacy, recent, ...fill(99)]
    // 101 non-favorites, cap 100: exactly the oldest one goes, and that is the
    // legacy row (Jan 2024) rather than an arbitrary NaN-sorted victim
    expect(staleSessionIds(list, undefined)).toEqual(['legacy'])
  })
})

// The permanent plugin list and the safe mode that is the way out of one that
// crashes the app. Both halves are tested here because the crash-marker trigger
// fires with no user involved at all.

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

const gwas = { name: 'GWAS', umdUrl: 'https://example.com/gwas.js' }
const apollo = { name: 'Apollo', umdUrl: 'https://example.com/apollo.js' }

const listKey = (url: string) => `jbrowse-permanent-plugins:${url}`
const markerKey = (url: string) => `jbrowse-plugin-load-marker:${url}`

// The module decides safe mode once, when it is first imported, so each test
// puts the url and the storage it wants in place and then imports a fresh copy.
async function importFresh(url = '/?config=volvox/config.json') {
  jest.resetModules()
  window.history.replaceState(null, '', url)
  return import('./permanentPlugins.ts')
}

beforeEach(() => {
  localStorage.clear()
})

test('a list is kept per config, not per origin', async () => {
  const one = await importFresh('/?config=volvox/config.json')
  one.addPermanentPlugin(gwas)

  const two = await importFresh('/?config=hg38/config.json')
  expect(two.readPermanentPlugins()).toEqual([])
  two.addPermanentPlugin(apollo)

  const back = await importFresh('/?config=volvox/config.json')
  expect(back.readPermanentPlugins()).toEqual([gwas])
})

// The hazard the resolved url exists for: jbrowse.org serves /code/jb2/main/
// and /code/jb2/latest/ from one origin, and a `?config=` naming the same
// relative file under each is two different deployments at two plugin ABIs.
test('one relative config path under two app paths is two lists', async () => {
  const main = await importFresh('/code/jb2/main/?config=test_data/config.json')
  main.addPermanentPlugin(gwas)
  const latest = await importFresh(
    '/code/jb2/latest/?config=test_data/config.json',
  )
  expect(latest.readPermanentPlugins()).toEqual([])
})

// ...and the other half of resolving it: the same config named two ways is one
// list, not two.
test('a relative and an absolute spelling of one config share a list', async () => {
  const relative = await importFresh('/app/?config=volvox/config.json')
  relative.addPermanentPlugin(gwas)
  const absolute = await importFresh(
    '/app/?config=http://localhost/app/volvox/config.json',
  )
  expect(absolute.readPermanentPlugins()).toEqual([gwas])
})

test('a page with no config param keys on the config it would fetch', async () => {
  const p = await importFresh('/app/')
  p.addPermanentPlugin(gwas)
  expect(
    JSON.parse(
      localStorage.getItem(listKey('http://localhost/app/config.json'))!,
    ),
  ).toEqual([gwas])
})

// Nothing but the config goes into the key: a `session=` differs per link, so
// folding the whole query in would mean a list that is never found twice.
test('the rest of the url does not change which list is found', async () => {
  const first = await importFresh('/?config=volvox/config.json')
  first.addPermanentPlugin(gwas)
  const second = await importFresh(
    '/?config=volvox/config.json&session=local-abc&loc=ctgA:1-100',
  )
  expect(second.readPermanentPlugins()).toEqual([gwas])
})

test('installing the same plugin twice keeps one entry, at the newer url', async () => {
  const p = await importFresh()
  p.addPermanentPlugin(gwas)
  p.addPermanentPlugin({ ...gwas, umdUrl: 'https://example.com/gwas-2.js' })
  expect(p.readPermanentPlugins()).toEqual([
    { name: 'GWAS', umdUrl: 'https://example.com/gwas-2.js' },
  ])
})

test('removing takes out the entry naming that plugin', async () => {
  const p = await importFresh()
  p.addPermanentPlugin(gwas)
  p.addPermanentPlugin(apollo)
  p.removePermanentPlugin(gwas)
  expect(p.readPermanentPlugins()).toEqual([apollo])
})

// An entry that names neither a url nor a store entry can never load, and
// samePlugin matches nothing against it — so it could only accumulate as a row
// nothing can remove.
test('an entry naming no loader is dropped on read', async () => {
  const p = await importFresh()
  localStorage.setItem(
    listKey('http://localhost/volvox/config.json'),
    JSON.stringify([gwas, { name: 'Broken' }, 'nonsense', null]),
  )
  expect(p.readPermanentPlugins()).toEqual([gwas])
})

// A ref is the form that survives this JBrowse being upgraded under the list:
// it carries no url of its own, and resolves against the store's manifest for
// whatever version is running when it next loads.
test('a bare store ref is kept, and loads', async () => {
  const p = await importFresh()
  const ref = { storePlugin: 'MsaView' }
  p.addPermanentPlugin(ref)
  expect(p.readPermanentPlugins()).toEqual([ref])
  expect(p.getPermanentPlugins()).toEqual([ref])
  expect(
    JSON.parse(
      localStorage.getItem(markerKey('http://localhost/volvox/config.json'))!,
    ),
  ).toEqual(['MsaView'])
})

test('a corrupt value reads as an empty list rather than throwing', async () => {
  const p = await importFresh()
  // the read reports the parse failure, which is the behavior being asked for —
  // taken here rather than printed
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  localStorage.setItem(listKey('http://localhost/volvox/config.json'), '{oh no')
  expect(p.readPermanentPlugins()).toEqual([])
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('Invalid localStorage value'),
    '{oh no',
    expect.any(SyntaxError),
  )
  warn.mockRestore()
})

test('a disabled entry is kept but not loaded', async () => {
  const p = await importFresh()
  p.addPermanentPlugin(gwas)
  p.addPermanentPlugin(apollo)
  p.setPermanentPluginDisabled(apollo, true)
  // the dialog edits the whole list, so it has to see the entry it is about to
  // switch back on
  expect(p.readPermanentPlugins()).toEqual([
    gwas,
    { ...apollo, disabled: true },
  ])
  expect(p.getPermanentPlugins()).toEqual([gwas])
})

test('enabling drops the flag rather than writing false', async () => {
  const p = await importFresh()
  p.addPermanentPlugin(gwas)
  p.setPermanentPluginDisabled(gwas, true)
  p.setPermanentPluginDisabled(gwas, false)
  expect(p.readPermanentPlugins()).toEqual([gwas])
})

test('loading arms the marker with what was about to run, success clears it', async () => {
  const p = await importFresh()
  p.addPermanentPlugin(gwas)
  expect(p.permanentPluginSafeMode()).toBeUndefined()
  expect(p.getPermanentPlugins()).toEqual([gwas])
  expect(
    JSON.parse(
      localStorage.getItem(markerKey('http://localhost/volvox/config.json'))!,
    ),
  ).toEqual(['GWAS (https://example.com/gwas.js)'])
  p.markPermanentPluginLoadSucceeded()
  expect(
    localStorage.getItem(markerKey('http://localhost/volvox/config.json')),
  ).toBeNull()
})

// Arming it unconditionally told a user who has never installed one that
// permanent plugins had failed, after any unrelated crash during session load —
// and put them in a safe mode that skips an empty list and changes nothing.
test('an empty list arms nothing', async () => {
  const p = await importFresh()
  expect(p.getPermanentPlugins()).toEqual([])
  expect(
    localStorage.getItem(markerKey('http://localhost/volvox/config.json')),
  ).toBeNull()
})

test('a list that is all switched off arms nothing', async () => {
  const p = await importFresh()
  p.addPermanentPlugin(gwas)
  p.setPermanentPluginDisabled(gwas, true)
  expect(p.getPermanentPlugins()).toEqual([])
  expect(
    localStorage.getItem(markerKey('http://localhost/volvox/config.json')),
  ).toBeNull()
})

test('a marker left by a crash turns safe mode on and names the suspects', async () => {
  localStorage.setItem(
    markerKey('http://localhost/volvox/config.json'),
    JSON.stringify(['GWAS (https://example.com/gwas.js)']),
  )
  const p = await importFresh()
  p.addPermanentPlugin(gwas)
  expect(p.permanentPluginSafeMode()).toBe('previousLaunchFailed')
  expect(p.permanentPluginSafeModeSuspects()).toEqual([
    'GWAS (https://example.com/gwas.js)',
  ])
  expect(p.getPermanentPlugins()).toEqual([])
})

// One deployment's crash is not another's: the marker is keyed the same way the
// list is, so the next config over loads normally.
test('safe mode is per config too', async () => {
  localStorage.setItem(
    markerKey('http://localhost/volvox/config.json'),
    JSON.stringify(['GWAS (x)']),
  )
  const other = await importFresh('/?config=hg38/config.json')
  expect(other.permanentPluginSafeMode()).toBeUndefined()
})

// Clearing it during a safe-mode boot re-armed the plugins for the next load,
// which reproduced the crash: the app worked every *other* time it was opened.
test('a safe-mode boot does not clear the marker', async () => {
  const key = markerKey('http://localhost/volvox/config.json')
  localStorage.setItem(key, JSON.stringify(['GWAS (x)']))
  const p = await importFresh()
  p.markPermanentPluginLoadSucceeded()
  expect(localStorage.getItem(key)).not.toBeNull()
})

test('nothing is accused when safe mode was asked for', async () => {
  localStorage.setItem(
    markerKey('http://localhost/volvox/config.json'),
    JSON.stringify(['GWAS (x)']),
  )
  const p = await importFresh('/?config=volvox/config.json&safeMode')
  expect(p.permanentPluginSafeMode()).toBe('requested')
  expect(p.permanentPluginSafeModeSuspects()).toEqual([])
})

// A jbrowse-web url whose params live in the hash keeps this one there too, so
// reading window.location.search directly would miss it.
test('safeMode is read from the hash when the params live there', async () => {
  const p = await importFresh('/#config=volvox/config.json&safeMode=1')
  expect(p.permanentPluginSafeMode()).toBe('requested')
  expect(p.getPermanentPlugins()).toEqual([])
})

// The banner's and the fatal dialog's two buttons, which are the whole way in
// and out of safe mode. jsdom implements no navigation, so the reload itself is
// a no-op here and what is pinned is the state each one leaves behind.
test('asking for safe mode puts it in the url, without touching the list', async () => {
  const p = await importFresh()
  p.addPermanentPlugin(gwas)
  const quiet = jest.spyOn(console, 'error').mockImplementation(() => {})
  p.reloadInSafeMode()
  quiet.mockRestore()
  expect(window.location.search).toContain('safeMode=1')
  expect(p.readPermanentPlugins()).toEqual([gwas])
})

test('turning them back on clears the marker that turned safe mode on', async () => {
  const key = markerKey('http://localhost/volvox/config.json')
  localStorage.setItem(key, JSON.stringify(['GWAS (x)']))
  const p = await importFresh('/?config=volvox/config.json&safeMode=1')
  const quiet = jest.spyOn(console, 'error').mockImplementation(() => {})
  p.reloadWithPermanentPlugins()
  quiet.mockRestore()
  expect(localStorage.getItem(key)).toBeNull()
  expect(window.location.search).not.toContain('safeMode')
})

test('a session is told when the list changes underneath it', async () => {
  const p = await importFresh()
  const seen: PluginDefinition[][] = []
  const stop = p.onPermanentPluginsChanged(() => {
    seen.push(p.readPermanentPlugins())
  })
  p.addPermanentPlugin(gwas)
  p.clearPermanentPlugins()
  stop()
  p.addPermanentPlugin(apollo)
  expect(seen).toEqual([[gwas], []])
})

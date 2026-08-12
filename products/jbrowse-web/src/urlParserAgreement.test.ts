// Two parsers read a JBrowse Web URL, and they are supposed to read it the same
// way.
//
// - jbrowse-web's own SessionLoader, off its address bar.
// - app-core's parseSessionSpecUrl, for anything ELSE holding such a URL:
//   Desktop's "Open JBrowse Web link...", the jbrowse:// protocol handler.
//
// parseSessionSpecUrl's header says that is its whole reason to exist — "so
// anything else holding such a URL resolves it identically instead of
// reimplementing the query format". Nothing checked it, and they had already
// drifted: the hub branch carried `&sessionTracks=` through in app-core and
// dropped it in web, so one link opened with an extra track in Desktop and
// without it, silently, in the browser.
//
// This pins the agreement on the three link forms both claim, and pins the
// disagreements that are deliberate — a parser that starts handling one of
// those should have to come here and say so.
//
// What it does NOT prove, so that nobody reads a green run as more than it is:
// the two share `buildLgvInit`, `readHubUrlParam`, `readNavParam`,
// `readTracklistParam` and `hubConnectionSpec`, so a shorthand field's decoding
// is one implementation and cannot drift. What can, and what these cases
// exercise, is everything around that — which branch wins when a link carries
// several things at once, which params each side bothers to read, and what each
// gates a view launch on. The `&sessionTracks=` bug was the second of those,
// and re-introducing it fails the hub-with-sessionTracks case; re-ordering the
// hub and shorthand branches fails fourteen of these.

import {
  hubConnectionSpec,
  parseSessionSpecUrl,
  type ParsedSessionSpec,
} from '@jbrowse/app-core'

import { createSessionLoaderFromUrl } from './createSessionLoader.ts'

jest.mock('./makeWorkerInstance', () => () => {})

// The comparable meaning of a link: what session it opens, stripped of the two
// parsers' different internal shapes. Everything here is a claim BOTH make.
interface Resolved {
  configUrl: string | undefined
  views: unknown[]
  sessionTracks: unknown[]
  sessionConnections: unknown[]
  sessionName: string | undefined
}

function setUrl(url: string) {
  window.history.replaceState(null, '', url)
}

// `config` is the one field the two legitimately represent differently, and the
// test rather than the parsers reconciles it: app-core resolves it against the
// instance the link points at, because its caller is outside that instance and
// needs something fetchable; web keeps the raw param because it fetches
// relative to itself. Same rule for the `none` sentinel on both sides, which is
// the part worth comparing — a parser that started treating `none` as a path
// would fetch `<instance>/none`.
function resolveConfigUrl(config: string | undefined) {
  return config && config !== 'none'
    ? new URL(config, window.location.href).href
    : undefined
}

function fromAppCore(url: string): Resolved {
  const { configUrl, spec, sessionName }: ParsedSessionSpec =
    parseSessionSpecUrl(url)
  return {
    configUrl,
    views: spec.views,
    sessionTracks: spec.sessionTracks ?? [],
    sessionConnections: spec.sessionConnections ?? [],
    sessionName,
  }
}

async function fromJbrowseWeb(): Promise<Resolved> {
  const loader = createSessionLoaderFromUrl(0)
  await loader.loadSessionByType()
  const source = loader.sessionSource
  if (source?.type === 'error') {
    throw source.error
  }
  const common = {
    configUrl: resolveConfigUrl(loader.configPath),
    sessionName: loader.sessionName,
  }
  if (source?.type === 'spec') {
    const spec = source.spec as {
      views?: unknown[]
      sessionTracks?: unknown[]
      sessionConnections?: unknown[]
    }
    return {
      ...common,
      views: spec.views ?? [],
      sessionTracks: spec.sessionTracks ?? [],
      sessionConnections: spec.sessionConnections ?? [],
    }
  }
  if (source?.type === 'hub') {
    // Mirrors what loadHubSpec does with this variant, which is where web's hub
    // session actually takes shape: the connection configs come from the same
    // hubConnectionSpec app-core uses, and the view launches only with an
    // assembly to resolve against (`launchInit`), a loc alone being reported
    // rather than honored.
    const { hubURL } = source.hubSpec
    const init = source.viewInit
    return {
      ...common,
      views: init?.assembly ? [{ type: 'LinearGenomeView', ...init }] : [],
      sessionTracks: source.sessionTracks ?? [],
      sessionConnections: hubURL.map(hubConnectionSpec),
    }
  }
  throw new Error(`jbrowse-web resolved this to "${source?.type}"`)
}

async function bothResolve(url: string) {
  setUrl(url)
  const web = await fromJbrowseWeb()
  // the absolute form, which is what an external holder of the link has
  const core = fromAppCore(window.location.href)
  return { web, core }
}

const TRACK =
  '[{"type":"FeatureTrack","trackId":"url_track","name":"URL track","assemblyNames":["volvox"],"adapter":{"type":"FromConfigAdapter","features":[]}}]'

describe('the two URL parsers agree', () => {
  test.each([
    ['the loc/assembly shorthand', '/?assembly=volvox&loc=ctgA:1-100'],
    [
      'the shorthand with tracks and a config',
      '/?config=test_data/volvox/config.json&assembly=volvox&loc=ctgA:1-100&tracks=a,b',
    ],
    [
      'the shorthand with every view flag',
      '/?assembly=volvox&loc=ctgA:1-100&nav=false&tracklist=true&highlight=ctgA:1-50',
    ],
    ['&regions= without a loc', '/?assembly=volvox&regions=ctgA,ctgB'],
    [
      '&sessionTracks= on the shorthand',
      `/?assembly=volvox&sessionTracks=${TRACK}`,
    ],
    ['a hub', '/?config=none&hubURL=https://example.com/hub.txt'],
    [
      'a hub with a place to open at',
      '/?config=none&hubURL=https://example.com/hub.txt&assembly=hubAsm&loc=chr1:1-100',
    ],
    [
      'a hub with a loc but no assembly',
      '/?config=none&hubURL=https://example.com/hub.txt&loc=chr1:1-100',
    ],
    [
      'a hub with sessionTracks',
      `/?config=none&hubURL=https://example.com/hub.txt&assembly=hubAsm&sessionTracks=${TRACK}`,
    ],
    [
      'two hubs',
      '/?config=none&hubURL=https://a.example/hub.txt,https://b.example/hub.txt',
    ],
    [
      'an empty hubURL, which is no hub rather than a blank one',
      '/?assembly=volvox&loc=ctgA:1-100&hubURL=',
    ],
    [
      'a session spec',
      '/?session=spec-{"views":[{"type":"LinearGenomeView","assembly":"volvox"}]}',
    ],
    [
      'a session spec with every top-level array',
      '/?session=spec-{"views":[],"sessionTracks":[{"trackId":"t"}],"sessionConnections":[{"connectionId":"c"}],"sessionAssemblies":[{"name":"a"}]}',
    ],
    [
      '&sessionName=',
      '/?assembly=volvox&loc=ctgA:1-100&sessionName=My%20Analysis',
    ],
    [
      'params in the hash fragment rather than the query string',
      '/#config=none&hubURL=https://example.com/hub.txt&assembly=hubAsm&loc=chr1:1-100',
    ],
    [
      'a spec in the hash fragment',
      '/#session=spec-{"views":[{"type":"DotplotView"}]}',
    ],
  ])('on %s', async (_name, url) => {
    const { web, core } = await bothResolve(url)
    expect(web).toEqual(core)
  })

  // the shorthand is the branch that ranks below the hub in both, so a link
  // carrying both must navigate INSIDE the hub in both rather than replacing it
  test('a hub outranks the shorthand in both', async () => {
    const { web, core } = await bothResolve(
      '/?config=none&hubURL=https://example.com/hub.txt&assembly=hubAsm&loc=chr1:1-100',
    )
    expect(web).toEqual(core)
    expect(core.sessionConnections).toHaveLength(1)
    expect(core.views).toHaveLength(1)
  })
})

// Where they differ on purpose. Each of these is a link jbrowse-web can open
// and nothing outside it can, so app-core refuses rather than resolving it to
// something subtly different — and the refusal has to name the reason, since it
// is what the person pasting the link reads.
describe('the disagreements are deliberate', () => {
  test.each([
    [
      'a share session, which needs web session store',
      '/?session=share-abc&password=xyz',
      'share',
    ],
    [
      'an encoded session, which needs its decoder',
      '/?session=encoded-abc',
      'encoded',
    ],
    [
      'a local session, which lives in this browser',
      '/?session=local-abc',
      'local',
    ],
    ['a json session snapshot', '/?session=json-{"session":{}}', 'json'],
  ])('app-core refuses %s', (_name, url, kind) => {
    setUrl(url)
    expect(() => parseSessionSpecUrl(window.location.href)).toThrow(
      new RegExp(`"${kind}" session link`),
    )
  })

  test('app-core refuses &extendSession=true, naming the param to remove', () => {
    setUrl('/?assembly=volvox&loc=ctgA:1-100&extendSession=true')
    expect(() => parseSessionSpecUrl(window.location.href)).toThrow(
      /extendSession=true/,
    )
  })

  // ...and jbrowse-web does handle it, by navigating the config's own
  // defaultSession. The asymmetry is the point: app-core builds a spec, and a
  // spec replaces the session rather than navigating one the config supplied.
  test('jbrowse-web handles &extendSession=true as a default session', async () => {
    setUrl('/?assembly=volvox&loc=ctgA:1-100&extendSession=true')
    const loader = createSessionLoaderFromUrl(0)
    await loader.loadSessionByType()
    expect(loader.sessionSource?.type).toBe('default')
  })

  test('a link with no session at all is refused with a usable message', () => {
    setUrl('/?config=test_data/volvox/config.json')
    expect(() => parseSessionSpecUrl(window.location.href)).toThrow(
      /no session in it/,
    )
  })
})

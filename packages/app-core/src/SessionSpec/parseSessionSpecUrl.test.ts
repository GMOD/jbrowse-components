import { parseSessionSpecUrl } from './parseSessionSpecUrl.ts'

const SPEC = { views: [{ type: 'LinearGenomeView', assembly: 'volvox' }] }
const encoded = `spec-${encodeURIComponent(JSON.stringify(SPEC))}`

test('parses a jbrowse-web figure link into its config and spec', () => {
  const { configUrl, spec, sessionName } = parseSessionSpecUrl(
    `https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=${encoded}&sessionName=Screenshot`,
  )
  expect(spec).toEqual(SPEC)
  expect(sessionName).toBe('Screenshot')
  // relative config resolves against the instance the link points at, so the
  // caller gets something it can actually fetch
  expect(configUrl).toBe(
    'https://jbrowse.org/code/jb2/main/test_data/volvox/config.json',
  )
})

test('keeps an absolute config url as-is', () => {
  const { configUrl } = parseSessionSpecUrl(
    `https://jbrowse.org/code/jb2/main/?config=${encodeURIComponent('https://jbrowse.org/demos/cgiab/config.json')}&session=${encoded}`,
  )
  expect(configUrl).toBe('https://jbrowse.org/demos/cgiab/config.json')
})

test('a spec with no config is allowed (self-contained sessionAssemblies)', () => {
  const { configUrl, spec } = parseSessionSpecUrl(
    `https://jbrowse.org/code/jb2/main/?session=${encoded}`,
  )
  expect(configUrl).toBeUndefined()
  expect(spec).toEqual(SPEC)
})

// config=none is how a self-contained link is actually written — omitting config
// makes jbrowse-web fall back to its own config.json. Resolving it would hand the
// caller `<instance>/none` to fetch, failing a link that needs no config at all.
test('treats config=none as no config, not a relative path', () => {
  const { configUrl } = parseSessionSpecUrl(
    `https://jbrowse.org/code/jb2/main/?config=none&session=${encoded}`,
  )
  expect(configUrl).toBeUndefined()
})

test('parses a hash-form link (jbrowse-web puts inline sessions in the hash)', () => {
  const { configUrl, spec, sessionName } = parseSessionSpecUrl(
    `https://jbrowse.org/code/jb2/main/#config=test_data/volvox/config.json&session=${encoded}&sessionName=Fig`,
  )
  expect(spec).toEqual(SPEC)
  expect(sessionName).toBe('Fig')
  expect(configUrl).toBe(
    'https://jbrowse.org/code/jb2/main/test_data/volvox/config.json',
  )
})

// Every "Open in Desktop" button sits next to the plain web link it wraps, so
// the one a user copies and pastes into "Open JBrowse Web link..." is as often
// the jbrowse:// url as the one inside it. Both have to work.
describe('a jbrowse:// wrapper', () => {
  const web = `https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=${encoded}&sessionName=Fig`
  const wrap = (inner: string) =>
    `jbrowse://open?url=${encodeURIComponent(inner)}`

  test('parses as the web link it carries', () => {
    expect(parseSessionSpecUrl(wrap(web))).toEqual(parseSessionSpecUrl(web))
  })

  test('resolves a relative config against the wrapped instance, not the wrapper', () => {
    expect(parseSessionSpecUrl(wrap(web)).configUrl).toBe(
      'https://jbrowse.org/code/jb2/main/test_data/volvox/config.json',
    )
  })

  test('never unwraps to a non-web url', () => {
    // the payload comes from whatever handed us the link, so a wrapped
    // file:// must not become something a caller goes on to fetch
    expect(() => parseSessionSpecUrl(wrap('file:///etc/passwd'))).toThrow(
      /no session in it/,
    )
  })

  test('reports a wrapper carrying no url at all as a link with no session', () => {
    expect(() => parseSessionSpecUrl('jbrowse://open')).toThrow(
      /no session in it/,
    )
  })
})

test('explains that a hash-form share link cannot be opened elsewhere', () => {
  expect(() =>
    parseSessionSpecUrl(
      'https://jbrowse.org/code/jb2/main/#session=encoded-abc123',
    ),
  ).toThrow(/only the JBrowse Web instance that created it/)
})

test('explains that a share link cannot be opened elsewhere', () => {
  expect(() =>
    parseSessionSpecUrl(
      'https://jbrowse.org/code/jb2/main/?session=share-abc123',
    ),
  ).toThrow(/only the JBrowse Web instance that created it/)
})

test('rejects a link with no session', () => {
  expect(() =>
    parseSessionSpecUrl('https://jbrowse.org/code/jb2/main/?config=x.json'),
  ).toThrow(/no session in it/)
})

// a hub link having no session is not the user pasting the wrong thing, so
// "go find a session=spec- link" is the wrong advice for it
test('points a track hub link at the connection route instead', () => {
  expect(() =>
    parseSessionSpecUrl(
      'https://jbrowse.org/code/jb2/main/?hubURL=https://example.com/hub.txt&config=none',
    ),
  ).toThrow(
    /track hub link \(https:\/\/example\.com\/hub\.txt\).*Open connection/,
  )
})

test('allows a deliberately empty views list (the import-form figures)', () => {
  expect(
    parseSessionSpecUrl(
      `https://jbrowse.org/code/jb2/main/?session=spec-${encodeURIComponent('{"views":[]}')}`,
    ).spec,
  ).toEqual({ views: [] })
})

test('rejects a spec with no views key at all', () => {
  expect(() =>
    parseSessionSpecUrl(
      `https://jbrowse.org/code/jb2/main/?session=spec-${encodeURIComponent('{"sessionName":"x"}')}`,
    ),
  ).toThrow(/no "views" list/)
})

test('rejects malformed spec JSON', () => {
  expect(() =>
    parseSessionSpecUrl(
      'https://jbrowse.org/code/jb2/main/?session=spec-{oops',
    ),
  ).toThrow(/isn't valid JSON/)
})

test('rejects a non-URL', () => {
  expect(() => parseSessionSpecUrl('not a url')).toThrow(/Not a URL/)
})

// The `&loc=`/`&assembly=` shorthand: the link form the URL params docs teach
// and the one people write by hand. jbrowse-web turns it into a spec of exactly
// one LGV (decodeJb1StyleSession); these pin that this does the same, since a
// link that means one view in web and another in Desktop is the whole failure
// this module exists to prevent.
describe('the loc/assembly shorthand', () => {
  const base = 'https://jbrowse.org/code/jb2/main/'

  test('becomes a spec of one LinearGenomeView', () => {
    const { spec, configUrl } = parseSessionSpecUrl(
      `${base}?config=test_data/volvox/config.json&assembly=volvox&loc=ctgA:1-100`,
    )
    expect(spec.views).toEqual([
      { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-100' },
    ])
    // the same config resolution a spec link gets
    expect(configUrl).toBe(`${base}test_data/volvox/config.json`)
  })

  test('an assembly with no loc is enough', () => {
    // opens the whole genome, which is a perfectly good thing for a link to ask
    expect(
      parseSessionSpecUrl(`${base}?assembly=volvox&config=none`).spec.views,
    ).toEqual([{ type: 'LinearGenomeView', assembly: 'volvox' }])
  })

  test('splits the comma-separated lists', () => {
    const [view] = parseSessionSpecUrl(
      `${base}?assembly=volvox&tracks=alignments,variants&regions=ctgA,ctgB`,
    ).spec.views
    expect(view).toMatchObject({
      tracks: ['alignments', 'variants'],
      displayedRegionNames: ['ctgA', 'ctgB'],
    })
  })

  // the two booleans default opposite ways round, which is exactly the sort of
  // thing a second implementation gets backwards
  test('nav is on unless the link says the literal false', () => {
    const nav = (query: string) =>
      (
        parseSessionSpecUrl(`${base}?assembly=volvox${query}`).spec
          .views[0] as { nav?: boolean }
      ).nav
    expect(nav('')).toBeUndefined()
    expect(nav('&nav=false')).toBe(false)
    expect(nav('&nav=true')).toBe(true)
    expect(nav('&nav=0')).toBe(true)
  })

  test('tracklist is off unless the link says the literal true', () => {
    const tracklist = (query: string) =>
      (
        parseSessionSpecUrl(`${base}?assembly=volvox${query}`).spec
          .views[0] as { tracklist?: boolean }
      ).tracklist
    expect(tracklist('')).toBeUndefined()
    expect(tracklist('&tracklist=true')).toBe(true)
    expect(tracklist('&tracklist=1')).toBe(false)
  })

  test('keeps a JSON highlight whole, and splits plain ones on spaces', () => {
    const highlight = '{"refName":"ctgA","start":1,"end":2} ctgB:5-6'
    expect(
      parseSessionSpecUrl(
        `${base}?assembly=volvox&highlight=${encodeURIComponent(highlight)}`,
      ).spec.views[0],
    ).toMatchObject({
      highlight: ['{"refName":"ctgA","start":1,"end":2}', 'ctgB:5-6'],
    })
  })

  test('carries sessionTracks, which the view then references by id', () => {
    const tracks = [{ type: 'FeatureTrack', trackId: 'mine' }]
    expect(
      parseSessionSpecUrl(
        `${base}?assembly=volvox&tracks=mine&sessionTracks=${encodeURIComponent(JSON.stringify(tracks))}`,
      ).spec.sessionTracks,
    ).toEqual(tracks)
  })

  test('reports sessionTracks that is not a list of configs', () => {
    expect(() =>
      parseSessionSpecUrl(`${base}?assembly=volvox&sessionTracks=%7B%7D`),
    ).toThrow(/not a list of track configurations/)
  })

  test('reports malformed sessionTracks JSON', () => {
    expect(() =>
      parseSessionSpecUrl(`${base}?assembly=volvox&sessionTracks=%5Boops`),
    ).toThrow(/"sessionTracks" in that link isn't valid JSON/)
  })

  test('takes its name from sessionName, as a spec link does', () => {
    expect(
      parseSessionSpecUrl(`${base}?assembly=volvox&sessionName=My%20view`)
        .sessionName,
    ).toBe('My view')
  })

  test('arrives the same way through a jbrowse:// wrapper', () => {
    const inner = `${base}?assembly=volvox&loc=ctgA:1-100`
    expect(
      parseSessionSpecUrl(`jbrowse://open?url=${encodeURIComponent(inner)}`)
        .spec.views,
    ).toEqual([
      { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-100' },
    ])
  })

  // web ranks &hubURL= above the shorthand, because a hub is the only param
  // that brings its own assemblies: a link carrying both is asking to navigate
  // inside the hub, not to drop it for a bare LGV
  test('a hub link carrying loc is still reported as a hub link', () => {
    expect(() =>
      parseSessionSpecUrl(
        `${base}?hubURL=https://example.com/hub.txt&assembly=hg38&loc=chr1:1-100`,
      ),
    ).toThrow(/track hub link/)
  })

  // &extendSession=true means "apply this onto the config's own defaultSession",
  // and a spec replaces the session rather than navigating one. Opening the view
  // without that session's curated tracks would quietly be a different session
  // than the link asks for.
  test('refuses extendSession rather than silently dropping it', () => {
    expect(() =>
      parseSessionSpecUrl(
        `${base}?config=none&assembly=volvox&loc=ctgA:1-100&extendSession=true`,
      ),
    ).toThrow(/extendSession.*Remove that parameter/s)
  })

  test('a link with neither a session nor an assembly still has nothing to open', () => {
    expect(() =>
      parseSessionSpecUrl(`${base}?config=x.json&tracks=alignments`),
    ).toThrow(/no session in it/)
  })
})

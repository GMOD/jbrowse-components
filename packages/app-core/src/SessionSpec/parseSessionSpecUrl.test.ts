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

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

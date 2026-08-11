import {
  findLaunchTarget,
  parseProtocolUrl,
  toProtocolUrl,
} from './launchTarget.ts'

const webUrl =
  'https://jbrowse.org/code/jb2/latest/?config=test_data/volvox/config.json&session=spec-%7B%22views%22%3A%5B%5D%7D'

test('round-trips a web url through a jbrowse:// link', () => {
  const link = toProtocolUrl(webUrl)
  expect(link.startsWith('jbrowse://open?url=')).toBe(true)
  // the whole url is one encoded param, so its own query survives intact
  expect(parseProtocolUrl(link)).toBe(webUrl)
})

test.each([
  // a link click must never become a local-file or arbitrary-scheme read
  ['jbrowse://open?url=file%3A%2F%2F%2Fetc%2Fpasswd'],
  ['jbrowse://open?url=javascript%3Aalert(1)'],
  // not ours / malformed / no payload
  ['igv://open?url=https%3A%2F%2Fjbrowse.org'],
  ['jbrowse://open'],
  ['jbrowse://open?url='],
  ['not a url at all'],
  [''],
])('rejects %s', input => {
  expect(parseProtocolUrl(input)).toBeUndefined()
})

test('finds a jbrowse:// link in argv (windows/linux delivery)', () => {
  expect(
    findLaunchTarget(['jbrowse-desktop', toProtocolUrl(webUrl)], '/home/me'),
  ).toEqual({ type: 'link', url: webUrl })
})

test('finds a session file in argv, resolved against the working directory', () => {
  expect(
    findLaunchTarget(['jbrowse-desktop', 'my.jbrowse'], '/home/me'),
  ).toEqual({ type: 'file', path: '/home/me/my.jbrowse' })
  expect(
    findLaunchTarget(['jbrowse-desktop', '/tmp/config.json'], '/home/me'),
  ).toEqual({ type: 'file', path: '/tmp/config.json' })
})

test('a link wins over a file, and a malformed link never falls back to one', () => {
  expect(
    findLaunchTarget(
      ['jbrowse-desktop', 'my.jbrowse', toProtocolUrl(webUrl)],
      '/home/me',
    ),
  ).toEqual({ type: 'link', url: webUrl })
  // a rejected link must not silently open some other argv file instead
  expect(
    findLaunchTarget(
      ['jbrowse-desktop', 'jbrowse://open?url=file%3A%2F%2F%2Fetc%2Fpasswd'],
      '/home/me',
    ),
  ).toBeUndefined()
  // ...and not even when a real file argument sits alongside the bad link: the
  // link claims the launch, so its rejection is a bad link, not "open the file"
  expect(
    findLaunchTarget(
      [
        'jbrowse-desktop',
        'my.jbrowse',
        'jbrowse://open?url=file%3A%2F%2F%2Fetc%2Fpasswd',
      ],
      '/home/me',
    ),
  ).toBeUndefined()
})

test('claims the authority-less jbrowse: form too', () => {
  // `jbrowse:open?url=…` is a valid URI a page can hand the OS, and Windows /
  // Linux pass it to argv verbatim
  expect(
    findLaunchTarget(
      ['jbrowse-desktop', `jbrowse:open?url=${encodeURIComponent(webUrl)}`],
      '/home/me',
    ),
  ).toEqual({ type: 'link', url: webUrl })
})

// the regression this guards: an argv payload the protocol predicate missed fell
// through to the file branch, where path.resolve climbed out of the working
// directory to an arbitrary local config — no link confirmation, and none of the
// plugin vetting a remote config gets
test('an authority-less link cannot traverse into a local file to open', () => {
  for (const arg of [
    'jbrowse:x/../../../../Downloads/evil.jbrowse',
    'jbrowse:open?url=file%3A%2F%2F%2Fetc%2Fsecret.json',
  ]) {
    expect(findLaunchTarget(['jbrowse-desktop', arg], '/home/me/work')).toBe(
      undefined,
    )
  }
})

test('recognizes the jbrowse:// scheme case-insensitively', () => {
  // URL schemes are case-insensitive and Windows preserves the caller's casing
  expect(
    findLaunchTarget(
      [
        'jbrowse-desktop',
        toProtocolUrl(webUrl).replace('jbrowse://', 'JBrowse://'),
      ],
      '/home/me',
    ),
  ).toEqual({ type: 'link', url: webUrl })
})

// The Windows installer points `.jbrowse` at us through a registry association,
// and Windows matches an extension without regard to case — so Explorer runs
// `jbrowse-desktop.exe "C:\...\Session.JBROWSE"` for a file that a case-
// sensitive endsWith reads as no file argument at all. That failure is silent:
// the app comes up on the start screen as if nothing had been double-clicked.
test('matches a launch file extension case-insensitively', () => {
  expect(
    findLaunchTarget(
      ['jbrowse-desktop', String.raw`C:\me\Session.JBROWSE`],
      'C:\\',
    ),
  ).toMatchObject({ type: 'file' })
  expect(
    findLaunchTarget(['jbrowse-desktop', '/tmp/Config.JSON'], '/home/me'),
  ).toEqual({ type: 'file', path: '/tmp/Config.JSON' })
})

test('ignores flags and the argv[0] binary path', () => {
  expect(
    findLaunchTarget(
      ['/apps/jbrowse.json/jbrowse-desktop', '--renderer=webgl'],
      '/',
    ),
  ).toBeUndefined()
})

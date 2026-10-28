import {
  findLaunchTarget,
  openFileTarget,
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
  ).toMatchObject({ type: 'invalid' })
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
  ).toMatchObject({ type: 'invalid' })
})

test('a jbrowse:// link with no usable url says so', () => {
  expect(
    findLaunchTarget(['jbrowse-desktop', 'jbrowse://open'], '/home/me'),
  ).toEqual({
    type: 'invalid',
    message: expect.stringContaining('needs a ?url='),
  })
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
    expect(
      findLaunchTarget(['jbrowse-desktop', arg], '/home/me/work'),
    ).toMatchObject({ type: 'invalid' })
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

describe('data files on the command line', () => {
  const target = (...args: string[]) =>
    findLaunchTarget(['jbrowse-desktop', ...args], '/home/me')

  test('a genome and data files become a plan, paths resolved', () => {
    const t = target('ref.fa', 'reads.bam', '--loc', 'chr1:1-100')
    expect(t).toMatchObject({
      type: 'plan',
      plan: {
        assemblyName: 'ref.fa',
        loc: 'chr1:1-100',
        show: [{ trackId: 'reads.bam', modifiers: [] }],
        tracks: [
          { adapter: { bamLocation: { localPath: '/home/me/reads.bam' } } },
        ],
      },
    })
  })

  test('a config.json beside data files is the config they open on', () => {
    expect(target('proj/config.json', 'reads.bam')).toMatchObject({
      type: 'plan',
      plan: {
        config: '/home/me/proj/config.json',
        show: [{ trackId: 'reads.bam', modifiers: [] }],
      },
    })
    // alone, it opens as it always has
    expect(target('proj/config.json')).toEqual({
      type: 'file',
      path: '/home/me/proj/config.json',
    })
  })

  test('flags that are not the launch grammar are left alone', () => {
    expect(
      target('--renderer', 'webgl', '--genome', 'hg38', '--no-sandbox'),
    ).toMatchObject({
      type: 'plan',
      plan: { config: 'https://jbrowse.org/ucsc/hg38/config.json' },
    })
    // a switch never takes the file after it as its value
    expect(
      target('--no-sandbox', 'ref.fa', '--enable-logging', 'reads.bam'),
    ).toMatchObject({
      type: 'plan',
      plan: {
        assemblyName: 'ref.fa',
        show: [{ trackId: 'reads.bam', modifiers: [] }],
      },
    })
    expect(target('--renderer', 'webgl')).toBeUndefined()
  })

  test('--config keeps its value, path or URL', () => {
    expect(target('--config', 'proj/config.json', 'reads.bam')).toMatchObject({
      type: 'plan',
      plan: {
        config: '/home/me/proj/config.json',
        show: [{ trackId: 'reads.bam', modifiers: [] }],
      },
    })
    expect(target('--config', 'https://h.org/config.json')).toMatchObject({
      type: 'plan',
      plan: { config: 'https://h.org/config.json' },
    })
  })

  test("jb2export's flags Desktop does not take go with their values, named", () => {
    expect(
      target('--width', '1400', 'ref.fa', '--multiwig', 'a.bw,b.bw', 'r.bam'),
    ).toMatchObject({
      type: 'plan',
      plan: {
        show: [{ trackId: 'r.bam', modifiers: [] }],
        unapplied: ['--width 1400', '--multiwig a.bw,b.bw'],
      },
    })
    expect(target('ref.fa', '--tracks', 't.json')).toMatchObject({
      type: 'plan',
      plan: { config: undefined, unapplied: ['--tracks t.json'] },
    })
    expect(
      target('ref.fa', '--opacity', '0.3', 'height:100', 'reads.bam'),
    ).toMatchObject({
      type: 'plan',
      plan: {
        show: [{ trackId: 'reads.bam', modifiers: [] }],
        unapplied: ['--opacity 0.3 height:100'],
      },
    })
    expect(target('--tracks', 't.json')).toBeUndefined()
    expect(target('--width', '1400', 'foo.json')).toMatchObject({
      type: 'file',
      path: '/home/me/foo.json',
    })
  })

  test("jb2export's boolean flags leave the file after them", () => {
    expect(target('ref.fa', '--refseq', 'reads.bam')).toMatchObject({
      type: 'plan',
      plan: {
        show: [{ trackId: 'reads.bam', modifiers: [] }],
        unapplied: ['--refseq'],
      },
    })
    expect(
      target('ref.fa', '--showGridlines', 'true', 'reads.bam'),
    ).toMatchObject({
      type: 'plan',
      plan: {
        show: [{ trackId: 'reads.bam', modifiers: [] }],
        unapplied: ['--showGridlines true'],
      },
    })
  })

  test('a file Desktop cannot open says so', () => {
    expect(target('notes.txt')).toEqual({
      type: 'invalid',
      message: expect.stringMatching(/cannot open notes\.txt/) as string,
    })
    expect(target('s.jbrowse', '--loc', 'chr1:1-100')).toEqual({
      type: 'invalid',
      message: expect.stringMatching(/s\.jbrowse is a saved session/) as string,
    })
    expect(openFileTarget('/data/notes.txt')).toMatchObject({ type: 'invalid' })
  })

  test('a plan that cannot be built says why', () => {
    expect(target('reads.bam')).toEqual({
      type: 'invalid',
      message: expect.stringMatching(/Name a genome/) as string,
    })
    expect(target('notes.txt', 'ref.fa')).toEqual({
      type: 'invalid',
      message: expect.stringMatching(
        /Unexpected argument "notes.txt"/,
      ) as string,
    })
  })

  test("jb2export's comparative command line opens a synteny view", () => {
    expect(
      target(
        '--fasta',
        'a.fa',
        'loc:chr1',
        '--paf',
        'a_b.paf',
        '--fasta',
        'b.fa',
        '--view',
        'mark.interpolate=bump',
        '--width',
        '1400',
      ),
    ).toMatchObject({
      type: 'plan',
      plan: {
        type: 'LinearSyntenyView',
        views: [{ assembly: 'a.fa', loc: 'chr1' }, { assembly: 'b.fa' }],
        tracks: [{ trackId: 'a_b.paf', assemblyNames: ['a.fa', 'b.fa'] }],
        view: { mark: { interpolate: 'bump' } },
        unapplied: ['--width 1400'],
      },
    })
    expect(target('a.fa', 'a_b.paf', 'b.fa')).toMatchObject({
      type: 'plan',
      plan: { type: 'LinearSyntenyView' },
    })
  })

  test('a leading subcommand word picks the view, as in jb2export', () => {
    expect(
      target('dotplot', '--chromSizes', 'a.sizes', '--chromSizes', 'b.sizes'),
    ).toMatchObject({
      type: 'plan',
      plan: {
        type: 'DotplotView',
        views: [{ assembly: 'a' }, { assembly: 'b' }],
      },
    })
    expect(target('lgv', 'ref.fa')).toMatchObject({
      type: 'plan',
      plan: { type: 'LinearGenomeView' },
    })
    expect(target('synteny', 'a.fa')).toEqual({
      type: 'invalid',
      message: expect.stringMatching(/two genomes or more/) as string,
    })
    expect(target('lgv', 'a.fa', 'b.fa')).toEqual({
      type: 'invalid',
      message: expect.stringMatching(/b\.fa is a genome/) as string,
    })
  })

  test('a link never becomes a plan, so it never names a local file', () => {
    expect(
      target(toProtocolUrl(webUrl), '/etc/ref.fa', '/etc/secret.bam'),
    ).toEqual({ type: 'link', url: webUrl })
  })

  test('a macOS open-file of a data file opens as that file on the command line', () => {
    expect(openFileTarget('/data/ref.fa')).toMatchObject({
      type: 'plan',
      plan: { assemblyName: 'ref.fa' },
    })
    expect(openFileTarget('/data/s.jbrowse')).toEqual({
      type: 'file',
      path: '/data/s.jbrowse',
    })
  })
})

test('ignores flags and the argv[0] binary path', () => {
  expect(
    findLaunchTarget(
      ['/apps/jbrowse.json/jbrowse-desktop', '--renderer=webgl'],
      '/',
    ),
  ).toBeUndefined()
})

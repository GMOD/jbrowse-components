import { SourceMapGenerator } from 'source-map-js'

import { mapStackTrace, parseStackLine } from './mapStackTrace.ts'

describe('parseStackLine', () => {
  test.each([
    ['    at foo (https://example.com/b.js:12:34)', 'foo'],
    ['    at Object.next (https://example.com/b.js:12:34)', 'Object.next'],
    ['    at new Foo (https://example.com/b.js:12:34)', 'new Foo'],
    // firefox format
    ['foo@https://example.com/b.js:12:34', 'foo'],
    // anonymous frame, no function name
    ['    at https://example.com/b.js:12:34', ''],
  ])('%s', (line, name) => {
    expect(parseStackLine(line)).toEqual({
      name,
      uri: 'https://example.com/b.js',
      line: 12,
      column: 34,
    })
  })

  test('keeps a port in the uri', () => {
    expect(
      parseStackLine('    at f (https://example.com:8080/b.js:1:2)')?.uri,
    ).toBe('https://example.com:8080/b.js')
  })

  test('keeps a query in the uri', () => {
    expect(
      parseStackLine('    at f (https://example.com/b.js?v=1:1:2)')?.uri,
    ).toBe('https://example.com/b.js?v=1')
  })

  // a blob: url embeds a second scheme; the uri must not truncate to the inner
  // https:// url, which points at a script that does not exist
  test('parses a blob: worker url', () => {
    expect(
      parseStackLine('    at w (blob:https://example.com/uuid:5:6)'),
    ).toEqual({
      name: 'w',
      uri: 'blob:https://example.com/uuid',
      line: 5,
      column: 6,
    })
  })

  test.each(['TypeError: x is not a function', '    at <anonymous>', ''])(
    'no frame in %s',
    line => {
      expect(parseStackLine(line)).toBeUndefined()
    },
  )
})

describe('mapStackTrace', () => {
  const script = 'https://example.com/bundle.js'
  // generated line 1: cols 0-19 come from foo.ts:10:0, cols 20+ from foo.ts:20:4
  const map = (() => {
    const g = new SourceMapGenerator({ file: 'bundle.js' })
    g.addMapping({
      generated: { line: 1, column: 0 },
      original: { line: 10, column: 0 },
      source: 'src/foo.ts',
    })
    g.addMapping({
      generated: { line: 1, column: 20 },
      original: { line: 20, column: 4 },
      source: 'src/foo.ts',
    })
    return g.toString()
  })()

  const fetchMock = jest.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock
  })

  function mockFiles(files: Record<string, string | undefined>) {
    fetchMock.mockImplementation((uri: string) => {
      const body = files[uri]
      return Promise.resolve({
        ok: body !== undefined,
        status: body === undefined ? 404 : 200,
        text: () => Promise.resolve(body ?? 'not found'),
      })
    })
  }

  test('maps a frame to its original position', async () => {
    const uri = `${script}?a`
    mockFiles({
      [uri]: `code\n//# sourceMappingURL=bundle.js.map`,
      'https://example.com/bundle.js.map?a': map,
    })
    // generated column 21 (1-based) is 0-based 20, the second mapping
    expect(await mapStackTrace(`    at foo (${uri}:1:21)`)).toBe(
      'src/foo.ts:20:5 (foo)',
    )
  })

  // stack traces report 1-based columns and source maps are 0-based. 1-based
  // col 20 is 0-based 19, still inside the first mapping — passing it through
  // unadjusted lands on the second mapping and reports the wrong function
  test('does not report the next mapping at a mapping boundary', async () => {
    const uri = `${script}#boundary`
    mockFiles({
      [uri]: `code\n//# sourceMappingURL=bundle.js.map`,
      'https://example.com/bundle.js.map': map,
    })
    expect(await mapStackTrace(`    at foo (${uri}:1:20)`)).toBe(
      'src/foo.ts:10:1 (foo)',
    )
  })

  // column 0 is a real original column, and must not be treated as "unmapped"
  test('maps a frame that lands on original column 0', async () => {
    const uri = `${script}#zero`
    mockFiles({
      [uri]: `code\n//# sourceMappingURL=bundle.js.map`,
      'https://example.com/bundle.js.map': map,
    })
    expect(await mapStackTrace(`    at foo (${uri}:1:1)`)).toBe(
      'src/foo.ts:10:1 (foo)',
    )
  })

  test('leaves non-frame lines alone', async () => {
    const uri = `${script}#msg`
    mockFiles({
      [uri]: `code\n//# sourceMappingURL=bundle.js.map`,
      'https://example.com/bundle.js.map': map,
    })
    expect(
      await mapStackTrace(`TypeError: bad\n    at foo (${uri}:1:21)`),
    ).toBe('TypeError: bad\nsrc/foo.ts:20:5 (foo)')
  })

  // one frame pointing at a script with no map, or an unreachable one, used to
  // throw and leave the entire trace unmapped
  test('maps what it can when another frame has no source map', async () => {
    const uri = `${script}#mixed`
    mockFiles({
      [uri]: `code\n//# sourceMappingURL=bundle.js.map`,
      'https://example.com/bundle.js.map': map,
      'https://cdn.example.com/vendor.js': 'code with no sourceMappingURL',
    })
    expect(
      await mapStackTrace(
        [
          '    at v (https://cdn.example.com/vendor.js:3:4)',
          '    at m (https://cdn.example.com/missing.js:3:4)',
          `    at foo (${uri}:1:21)`,
        ].join('\n'),
      ),
    ).toBe(
      [
        '    at v (https://cdn.example.com/vendor.js:3:4)',
        '    at m (https://cdn.example.com/missing.js:3:4)',
        'src/foo.ts:20:5 (foo)',
      ].join('\n'),
    )
  })

  test('leaves a frame the map does not cover raw', async () => {
    const uri = `${script}#uncovered`
    mockFiles({
      [uri]: `code\n//# sourceMappingURL=bundle.js.map`,
      'https://example.com/bundle.js.map': map,
    })
    // line 99 has no mappings
    expect(await mapStackTrace(`    at foo (${uri}:99:1)`)).toBe(
      `    at foo (${uri}:99:1)`,
    )
  })

  test('fetches a script once for repeated frames', async () => {
    const uri = `${script}#cached`
    mockFiles({
      [uri]: `code\n//# sourceMappingURL=bundle.js.map`,
      'https://example.com/bundle.js.map': map,
    })
    await mapStackTrace(
      [`    at a (${uri}:1:21)`, `    at b (${uri}:1:21)`].join('\n'),
    )
    // the script plus its map, not once per frame
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('uses the last sourceMappingURL annotation', async () => {
    const uri = `${script}#last`
    mockFiles({
      [uri]: `//# sourceMappingURL=inlined-dep.js.map\ncode\n//# sourceMappingURL=bundle.js.map`,
      'https://example.com/bundle.js.map': map,
    })
    expect(await mapStackTrace(`    at foo (${uri}:1:21)`)).toBe(
      'src/foo.ts:20:5 (foo)',
    )
  })

  test('carries the script query onto a relative map url', async () => {
    const uri = `${script}?v=abc`
    mockFiles({
      [uri]: `code\n//# sourceMappingURL=bundle.js.map`,
      'https://example.com/bundle.js.map?v=abc': map,
    })
    expect(await mapStackTrace(`    at foo (${uri}:1:21)`)).toBe(
      'src/foo.ts:20:5 (foo)',
    )
  })

  test('does not append the script query to an inline data: map', async () => {
    const uri = `${script}?v=def`
    const dataUri = `data:application/json;base64,${btoa(map)}`
    mockFiles({
      [uri]: `code\n//# sourceMappingURL=${dataUri}`,
      [dataUri]: map,
    })
    expect(await mapStackTrace(`    at foo (${uri}:1:21)`)).toBe(
      'src/foo.ts:20:5 (foo)',
    )
  })
})

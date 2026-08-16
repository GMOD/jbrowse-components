// `config/jest/jsdomWithFetch.cjs` installs node's fetch primitives over
// jsdom's, and which types it may override is a real contract rather than a
// preference: undici's checks are duck-typed and accept jsdom's objects, while
// jsdom's webidl2js wrappers accept only their own. So a type jsdom implements
// AND brand-checks has to stay jsdom's, and one it does not implement at all
// has to be node's.
//
// Nothing pinned that, and the cost was silent: overriding `Blob` for symmetry
// with `Response` broke `FileReader` for six export tests in two suites and
// nothing else, so a full run had to notice. These assertions are cheap and run
// in every project that uses the environment.

test('a Blob the app constructs is readable by jsdom FileReader', async () => {
  // The failure this replaces: node's Blob reaching jsdom's readAsText threw
  // "parameter 1 is not of type 'Blob'". Every "export a file, read back what
  // was saved" test goes through exactly this pair.
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('FileReader error'))
    }
    reader.readAsText(new Blob(['hello'], { type: 'text/plain' }))
  })
  expect(text).toBe('hello')
})

test('and readable by .text(), which config/jest/blob.js fills in', () => {
  // jsdom implements only slice/size/type. The shim fills text/arrayBuffer/
  // stream off its own FileReader, so both idioms work against one Blob —
  // `SaveTrackData.test.tsx` reads with `.text()`, the export tests with a
  // FileReader, and neither has to know which realm won.
  return expect(new Blob(['hello']).text()).resolves.toBe('hello')
})

// The cost of that choice, asserted so it is a known limitation rather than a
// surprise: undici does NOT recognize jsdom's Blob and stringifies it, even
// with the duck-typed members its `isBlobLike` looks for now present. No test
// in the repo constructs a Response from a Blob or calls `.blob()` on one — the
// Blobs here go from app code straight to `saveAs`/FileReader/`.text()`, which
// is the browser's own pairing — but a test that needs both realms at once has
// to know this is where they part.
test('undici does not accept that Blob as a body, and nothing asks it to', async () => {
  expect(await new Response(new Blob(['body'])).text()).toBe('[object Blob]')
})

test('AbortSignal stays jsdom’s too, for jsdom EventTarget', () => {
  // Same rule, already documented and previously untested: a node-realm signal
  // throws "member 'signal' that is not of type 'AbortSignal'" here, and every
  // drag gesture in the app aborts its listeners this way.
  const controller = new AbortController()
  expect(() => {
    document.addEventListener('mousemove', () => {}, {
      signal: controller.signal,
    })
  }).not.toThrow()
  controller.abort()
})

test('Headers is node’s, because jsdom’s strips the range request header', () => {
  // The whole reason the environment exists. RemoteFileWithRangeCache is most
  // of what this repo fetches.
  expect(new Headers({ range: 'bytes=0-10' }).get('range')).toBe('bytes=0-10')
})

test('ReadableStream is node’s, because jsdom implements no streams', () => {
  expect(typeof ReadableStream).toBe('function')
})

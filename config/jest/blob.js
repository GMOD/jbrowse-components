// jsdom's Blob implements only `slice`/`size`/`type` — no `text`,
// `arrayBuffer` or `stream` (jsdom/jsdom#2555, still true in jsdom 26). Its
// FileReader is complete, so this fills the three off FileReader rather than
// replacing the Blob itself.
//
// Replacing it is the thing NOT to do here, and `jsdomWithFetch.cjs` used to:
// node's Blob has all three, but jsdom's `FileReader.readAsText` brand-checks
// its argument, so installing node's threw "parameter 1 is not of type 'Blob'"
// for every test that read back a file the app had saved. One realm has to own
// the type, and jsdom's is the one the DOM APIs accept.
//
// `stream` is filled for the same reason as the other two rather than for
// undici: `new Response(jsdomBlob)` still stringifies to "[object Blob]" with
// all three present, which `jsdomRealms.test.ts` asserts as the known cost of
// letting jsdom own the type. Nothing in the repo constructs a Response from a
// Blob.
//
// Conditional, so a jsdom that grows real implementations wins over these —
// the same rule `structuredClone.js` states at more length.

function readAs(blob, method) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result)
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('FileReader error'))
    }
    reader[method](blob)
  })
}

if (typeof Blob === 'function') {
  if (typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = function arrayBuffer() {
      return readAs(this, 'readAsArrayBuffer')
    }
  }
  if (typeof Blob.prototype.text !== 'function') {
    Blob.prototype.text = function text() {
      return readAs(this, 'readAsText')
    }
  }
  if (typeof Blob.prototype.stream !== 'function') {
    Blob.prototype.stream = function stream() {
      const chunk = this.arrayBuffer()
      return new ReadableStream({
        async start(controller) {
          controller.enqueue(new Uint8Array(await chunk))
          controller.close()
        },
      })
    }
  }
}

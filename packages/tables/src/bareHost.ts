// The web globals JBrowse's data stack reads, for a host that is bare
// ECMAScript (R's V8, Node's vm, an embedded engine): what the readers need of
// fetch, TextDecoder, URL, AbortController and the timers, and no more. The
// bytes of every fetch come from the host's own `readRange`.

const g = globalThis as Record<string, unknown>

const B64 = new Uint8Array(128)
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (let i = 0; i < ALPHABET.length; i++) {
  B64[ALPHABET.charCodeAt(i)] = i
}

function fromBase64(encoded: string) {
  const s = encoded.replaceAll(/[^A-Za-z0-9+/=]/g, '')
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0
  const out = new Uint8Array((s.length / 4) * 3 - pad)
  let o = 0
  for (let i = 0; i < s.length; i += 4) {
    const n =
      (B64[s.charCodeAt(i)]! << 18) |
      (B64[s.charCodeAt(i + 1)]! << 12) |
      (B64[s.charCodeAt(i + 2)]! << 6) |
      B64[s.charCodeAt(i + 3)]!
    if (o < out.length) {
      out[o++] = (n >> 16) & 255
    }
    if (o < out.length) {
      out[o++] = (n >> 8) & 255
    }
    if (o < out.length) {
      out[o++] = n & 255
    }
  }
  return out
}

// An ASCII run this long joins the output in one call rather than code by code
const ASCII_RUN = 64

// UTF-8 as the WHATWG decoder reads it: an invalid or truncated sequence is
// one U+FFFD, and decoding resumes at the byte that broke it; `fatal` throws
// there instead.
export class TextDecoderShim {
  readonly encoding = 'utf-8'
  readonly fatal: boolean
  constructor(_label = 'utf-8', options: { fatal?: boolean } = {}) {
    this.fatal = Boolean(options.fatal)
  }
  decode(input?: ArrayBufferView | ArrayBuffer) {
    if (!input) {
      return ''
    }
    const b = ArrayBuffer.isView(input)
      ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
      : new Uint8Array(input)
    const units: number[] = []
    let out = ''
    let i = 0
    while (i < b.length) {
      const c = b[i]!
      let j = i + 1
      if (c < 0x80) {
        while (j < b.length && j - i < 8192 && b[j]! < 0x80) {
          j++
        }
        if (j - i >= ASCII_RUN) {
          out +=
            String.fromCharCode(...units) +
            String.fromCharCode.apply(
              null,
              b.subarray(i, j) as unknown as number[],
            )
          units.length = 0
        } else {
          for (let k = i; k < j; k++) {
            units.push(b[k]!)
          }
        }
      } else {
        const need =
          c < 0xc2 ? -1 : c < 0xe0 ? 1 : c < 0xf0 ? 2 : c < 0xf5 ? 3 : -1
        let cp = need === 1 ? c & 0x1f : need === 2 ? c & 0x0f : c & 0x07
        // the second byte's range rules out overlong forms and surrogates
        const lo = c === 0xe0 ? 0xa0 : c === 0xf0 ? 0x90 : 0x80
        const hi = c === 0xed ? 0x9f : c === 0xf4 ? 0x8f : 0xbf
        let ok = need > 0
        for (let k = 0; ok && k < need; k++) {
          const t = b[j]
          if (
            t !== undefined &&
            t >= (k === 0 ? lo : 0x80) &&
            t <= (k === 0 ? hi : 0xbf)
          ) {
            cp = (cp << 6) | (t & 0x3f)
            j++
          } else {
            ok = false
          }
        }
        if (ok) {
          if (cp > 0xffff) {
            cp -= 0x10000
            units.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff))
          } else {
            units.push(cp)
          }
        } else if (this.fatal) {
          throw new TypeError('The encoded data was not valid utf-8')
        } else {
          units.push(0xfffd)
        }
      }
      i = j
      if (units.length > 8192) {
        out += String.fromCharCode(...units)
        units.length = 0
      }
    }
    return out + String.fromCharCode(...units)
  }
}

export class TextEncoderShim {
  encode(s = '') {
    const out: number[] = []
    for (const ch of s) {
      const cp = ch.codePointAt(0)!
      if (cp < 0x80) {
        out.push(cp)
      } else if (cp < 0x800) {
        out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63))
      } else if (cp < 0x10000) {
        out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63))
      } else {
        out.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 63),
          0x80 | ((cp >> 6) & 63),
          0x80 | (cp & 63),
        )
      }
    }
    return new Uint8Array(out)
  }

  /** As the WHATWG encoder: whole characters until `dest` is full, `read` in UTF-16 units. */
  encodeInto(s: string, dest: Uint8Array) {
    let read = 0
    let written = 0
    for (const ch of s) {
      const bytes = this.encode(ch)
      if (written + bytes.length > dest.length) {
        break
      }
      dest.set(bytes, written)
      written += bytes.length
      read += ch.length
    }
    return { read, written }
  }
}

class AbortSignalShim {
  static any() {
    return new AbortSignalShim()
  }
  static timeout() {
    return new AbortSignalShim()
  }
  static abort(reason?: unknown) {
    const s = new AbortSignalShim()
    s.aborted = true
    s.reason = reason
    return s
  }
  aborted = false
  reason: unknown
  addEventListener() {}
  removeEventListener() {}
  throwIfAborted() {}
}

class AbortControllerShim {
  signal = new AbortSignalShim()
  abort(reason?: unknown) {
    this.signal.aborted = true
    this.signal.reason = reason
  }
}

class URLShim {
  href: string
  protocol: string
  host: string
  hostname: string
  pathname: string
  search = ''
  hash = ''
  origin: string
  constructor(url: string, base?: string | URLShim) {
    let href = String(url)
    if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && base !== undefined) {
      const b = String(base)
      href = href.startsWith('/')
        ? b.replace(/^([a-z][a-z0-9+.-]*:\/\/[^/]*).*$/i, '$1') + href
        : b.replace(/[^/]*$/, '') + href
    }
    const m =
      /^([a-z][a-z0-9+.-]*:)(\/\/([^/?#]*))?([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(
        href,
      )
    if (!m) {
      throw new TypeError(`Invalid URL: ${href}`)
    }
    this.href = href
    this.protocol = m[1]!
    this.host = m[3] ?? ''
    this.hostname = this.host.replace(/:\d+$/, '')
    this.pathname = m[4] ?? ''
    this.search = m[5] ?? ''
    this.hash = m[6] ?? ''
    this.origin = `${this.protocol}//${this.host}`
  }
  toString() {
    return this.href
  }
}

interface HeadersLike {
  forEach(f: (value: string, name: string) => void): void
}

class HeadersShim {
  private map = new Map<string, string>()
  constructor(init?: unknown) {
    if (Array.isArray(init)) {
      for (const [k, v] of init as [string, string][]) {
        this.set(k, v)
      }
    } else if (
      typeof (init as Partial<HeadersLike> | undefined)?.forEach === 'function'
    ) {
      ;(init as HeadersLike).forEach((v, k) => {
        this.set(k, v)
      })
    } else {
      for (const [k, v] of Object.entries(
        (init ?? {}) as Record<string, string>,
      )) {
        this.set(k, v)
      }
    }
  }
  get(name: string) {
    return this.map.get(name.toLowerCase()) ?? null
  }
  has(name: string) {
    return this.map.has(name.toLowerCase())
  }
  set(name: string, value: string) {
    this.map.set(name.toLowerCase(), String(value))
  }
  append(name: string, value: string) {
    this.set(name, value)
  }
  delete(name: string) {
    this.map.delete(name.toLowerCase())
  }
  forEach(f: (v: string, k: string) => void) {
    this.map.forEach(f)
  }
  entries() {
    return this.map.entries()
  }
  [Symbol.iterator]() {
    return this.map.entries()
  }
}

/**
 * A host's answer to a byte range: the HTTP-style status, the whole file's
 * size, and the bytes, as a Uint8Array or base64 (what R's jsonlite sends). A
 * host bridge that wraps each value in a one-element array is tolerated.
 */
export interface HostRange {
  status: number
  size: number
  bytes: Uint8Array | string
}

/**
 * Reads bytes `start` to `end` inclusive of `url`, `end` -1 for the rest of
 * the file. Synchronous, as a host bridge such as V8's `console.r.call` is.
 */
export type ReadRange = (url: string, start: number, end: number) => HostRange

let readRange: ReadRange = () => {
  throw new Error('installBareHostGlobals was not given a readRange')
}

function rangeOf(headers: unknown) {
  const v = new HeadersShim(headers).get('range')
  const m = v ? /bytes=(\d+)-(\d*)/.exec(v) : null
  return m ? ([Number(m[1]), m[2] ? Number(m[2]) : -1] as const) : undefined
}

// A bridge such as V8's console.r.call wraps each scalar in an array
function one<T>(v: unknown) {
  return (Array.isArray(v) ? v[0] : v) as T
}

/**
 * The uncompressed size of each file the host last read whole: an index, or
 * a file an adapter parses whole, either of which the adapter keeps.
 */
export const wholeFileBytes = new Map<string, number>()

/**
 * The bytes `file` inflates to: the sum of its BGZF blocks' sizes, a plain
 * gzip's last member size, or its own length if it is not gzip.
 */
export function inflatedSize(file: Uint8Array) {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength)
  const gzipAt = (at: number) =>
    at + 18 <= file.length && file[at] === 0x1f && file[at + 1] === 0x8b
  const bgzfAt = (at: number) =>
    gzipAt(at) && file[at + 12] === 66 && file[at + 13] === 67
  if (!gzipAt(0)) {
    return file.length
  }
  if (!bgzfAt(0)) {
    return view.getUint32(file.length - 4, true)
  }
  let total = 0
  let at = 0
  while (bgzfAt(at)) {
    const next = at + view.getUint16(at + 16, true) + 1
    if (next > file.length) {
      break
    }
    total += view.getUint32(next - 4, true)
    at = next
  }
  return total
}

function fetchFromHost(
  url: string,
  range: readonly [number, number] | undefined,
) {
  const [start, end] = range ?? [0, -1]
  const r = readRange(url, start, end) as Record<keyof HostRange, unknown>
  const body = one<Uint8Array | string | undefined>(r.bytes) ?? ''
  const bytes = typeof body === 'string' ? fromBase64(body) : body
  if (!range) {
    wholeFileBytes.set(url, inflatedSize(bytes))
  }
  return {
    status: one<number>(r.status),
    size: one<number>(r.size),
    bytes,
  }
}

export async function fetchShim(
  input: string | URLShim,
  init?: { headers?: unknown },
) {
  const url = String(input)
  const range = rangeOf(init?.headers)
  const [start] = range ?? [0]
  const data = /^data:[^,]*;base64,/.exec(url)
  const { status, size, bytes } = data
    ? (() => {
        const b = fromBase64(url.slice(data[0].length))
        return { status: 200, size: b.length, bytes: b }
      })()
    : fetchFromHost(url, range)
  // a range starting at or past the end of the file is unsatisfiable, as a
  // server answers it; a 206 naming an end before its start is refused
  const past = !data && start > 0 && start >= size
  const last = start + bytes.length - 1
  return {
    ok: !past && status >= 200 && status < 300,
    status: past ? 416 : status,
    statusText: '',
    url: String(input),
    headers: new HeadersShim({
      'content-length': String(bytes.length),
      'content-range': past
        ? `bytes */${size}`
        : `bytes ${start}-${last}/${size}`,
    }),
    body: {
      getReader() {
        let sent = false
        return {
          read: async () => {
            if (sent) {
              return { done: true, value: undefined }
            }
            sent = true
            return { done: false, value: bytes }
          },
          cancel: async () => {},
          releaseLock() {},
        }
      },
      cancel: async () => {},
    },
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    bytes: async () => bytes,
    text: async () => new TextDecoderShim().decode(bytes),
    json: async () => JSON.parse(new TextDecoderShim().decode(bytes)),
  }
}

/**
 * What the data stack asks of `Intl`, for a V8 built without ICU, as R's is: a
 * grapheme segmenter splitting code points, which differs only on a combining
 * sequence or an emoji join, a collator comparing UTF-16 code units, and a
 * number format printing the number plainly.
 */
export const IntlShim = {
  Segmenter: class {
    segment(text: string) {
      let index = 0
      return Array.from(text, segment => {
        const s = { segment, index, input: text }
        index += segment.length
        return s
      })
    }
  },
  Collator: class {
    compare(a: string, b: string) {
      return a < b ? -1 : a > b ? 1 : 0
    }
  },
  NumberFormat: class {
    format = String
  },
}

/**
 * Installs the web globals the data stack reads where the host has none,
 * leaving any it has, with `host` answering every byte range.
 */
export function installBareHostGlobals(host: ReadRange) {
  readRange = host
  let timers = 0
  g.TextDecoder ??= TextDecoderShim
  g.TextEncoder ??= TextEncoderShim
  g.AbortController ??= AbortControllerShim
  g.AbortSignal ??= AbortSignalShim
  g.URL ??= URLShim
  g.Headers ??= HeadersShim
  // always, unlike the others: a host that has a fetch of its own (Node, Deno)
  // still means every byte to come from its readRange
  g.fetch = fetchShim
  g.self ??= globalThis
  g.queueMicrotask ??= (f: () => void) => {
    void Promise.resolve().then(f)
  }
  // No event loop, so a delay never elapses: a timer with one is a timeout
  // guarding a request, which has answered by the time it would fire.
  g.setTimeout ??= (f: () => void, delay = 0) => {
    if (delay <= 0) {
      void Promise.resolve().then(f)
    }
    return ++timers
  }
  g.clearTimeout ??= () => {}
  g.setInterval ??= () => ++timers
  g.clearInterval ??= () => {}
  g.performance ??= { now: () => Date.now() }
  g.atob ??= (s: string) => String.fromCharCode(...fromBase64(s))
  const intl = (g.Intl ??= {}) as Record<string, unknown>
  for (const [name, shim] of Object.entries(IntlShim)) {
    intl[name] ??= shim
  }
}

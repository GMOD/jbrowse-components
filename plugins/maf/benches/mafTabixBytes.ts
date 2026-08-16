import type {
  ParsedAssemblyName,
  SourceResolver,
} from '../src/util/parseAssemblyName.ts'

const TAB = 9
const COLON = 58
const MINUS = 45
const ZERO = 48

/**
 * The byte half of `scanMafTabixEntry`, for a reader that has the line as bytes
 * rather than as a string — `@gmod/tabix`'s `lineBytesCallback`, which hands
 * over the decompressed bgzf block and the line's range within it.
 *
 * Same fields, same tolerance for a malformed entry, and the same skip of
 * field 3 (`size`). The difference is that `seq` never becomes a string: the
 * caller gets its range and hands `buffer.subarray(seqStart, seqEnd)` to
 * `MafWirePacker`, which takes bytes as readily as a string, so the alignment
 * text is copied once into the arena instead of being decoded to UTF-16, sliced
 * out, and re-encoded.
 */
export interface ParsedMafTabixEntryBytes {
  assemblyName: string
  chr: string
  start: number
  strand: number
  srcSize: number | undefined
  seqStart: number
  seqEnd: number
}

/** `[start, end)` of column `n` (0-based), or undefined if the line has none. */
export function columnRange(
  buffer: Uint8Array,
  lineStart: number,
  lineEnd: number,
  n: number,
) {
  let start = lineStart
  for (let i = 0; i < n; i++) {
    const tab = buffer.indexOf(TAB, start)
    if (tab === -1 || tab >= lineEnd) {
      return undefined
    }
    start = tab + 1
  }
  const tab = buffer.indexOf(TAB, start)
  return { start, end: tab === -1 || tab > lineEnd ? lineEnd : tab }
}

function parseUint(buffer: Uint8Array, from: number, to: number) {
  let n = 0
  for (let i = from; i < to; i++) {
    const digit = buffer[i]! - ZERO
    if (digit < 0 || digit > 9) {
      return Number.NaN
    }
    n = n * 10 + digit
  }
  return n
}

/**
 * `makeSourceResolver`'s memo, keyed on bytes instead of on a string.
 *
 * The string resolver is already memoized because a region holds only a couple
 * dozen distinct source tokens against tens of thousands of rows — but reaching
 * it from bytes means decoding the token to make the key, which is the per-row
 * cost the byte path exists to avoid. Hashing the token's bytes and verifying a
 * candidate byte-for-byte gives the same answer with no decode on a hit, and a
 * hit is every row after the first block.
 */
export function makeByteSourceResolver(resolve: SourceResolver) {
  const decoder = new TextDecoder()
  const buckets = new Map<
    number,
    { token: Uint8Array; value: ParsedAssemblyName | undefined }[]
  >()
  return (buffer: Uint8Array, from: number, to: number) => {
    let hash = 0x811c9dc5
    for (let i = from; i < to; i++) {
      hash = Math.imul(hash ^ buffer[i]!, 0x01000193)
    }
    const length = to - from
    let bucket = buckets.get(hash)
    if (bucket) {
      for (const entry of bucket) {
        if (entry.token.length === length) {
          let same = true
          for (let i = 0; i < length; i++) {
            if (entry.token[i] !== buffer[from + i]) {
              same = false
              break
            }
          }
          if (same) {
            return entry.value
          }
        }
      }
    } else {
      bucket = []
      buckets.set(hash, bucket)
    }
    const value = resolve(decoder.decode(buffer.subarray(from, to)))
    bucket.push({ token: buffer.slice(from, to), value })
    return value
  }
}

export type ByteSourceResolver = ReturnType<typeof makeByteSourceResolver>

/** {@link ParsedMafTabixEntryBytes} for the entry at `[from, to)`. */
export function scanMafTabixEntryBytes(
  buffer: Uint8Array,
  from: number,
  to: number,
  resolve: ByteSourceResolver,
): ParsedMafTabixEntryBytes | undefined {
  const c0 = buffer.indexOf(COLON, from)
  if (c0 === -1 || c0 >= to || c0 === from) {
    return undefined
  }
  const c1 = buffer.indexOf(COLON, c0 + 1)
  const c2 = c1 === -1 ? -1 : buffer.indexOf(COLON, c1 + 1)
  const c3 = c2 === -1 ? -1 : buffer.indexOf(COLON, c2 + 1)
  const c4 = c3 === -1 ? -1 : buffer.indexOf(COLON, c3 + 1)
  if (c4 === -1 || c4 >= to || c4 + 1 === to) {
    return undefined
  }
  const parsed = resolve(buffer, from, c0)
  if (!parsed?.assemblyName) {
    return undefined
  }
  return {
    assemblyName: parsed.assemblyName,
    chr: parsed.chr,
    start: parseUint(buffer, c0 + 1, c1),
    strand: buffer[c2 + 1] === MINUS ? -1 : 1,
    srcSize: parseUint(buffer, c3 + 1, c4),
    seqStart: c4 + 1,
    seqEnd: to,
  }
}

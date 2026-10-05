import { makeSourceResolver } from '../util/parseAssemblyName.ts'
import { RecordSlots } from '../util/recordSlots.ts'
import { freeRowId } from '../util/sampleCopies.ts'

import type { MafBlockSink } from '../util/mafBlockSink.ts'
import type { RecordKey } from '../util/recordSlots.ts'

interface Token {
  key: RecordKey
  chr: string
}

const MINUS = 45
const ZERO = 48

// `parseInt(text.slice(from, to), 10)` without the slice where the field is a
// plain run of digits.
function parseDecimal(text: string, from: number, to: number) {
  const n = to - from
  if (n > 0 && n <= 15) {
    let value = 0
    for (let i = from; i < to; i++) {
      const d = text.charCodeAt(i) - ZERO
      if (d < 0 || d > 9) {
        return Number.parseInt(text.slice(from, to), 10)
      }
      value = value * 10 + d
    }
    return value
  }
  return Number.parseInt(text.slice(from, to), 10)
}

/**
 * The MAF-tabix alignment column into a {@link MafBlockSink}, each sequence a
 * range of the column. An entry is `sample.chr:start:size:strand:srcSize:seq`,
 * every field inside the entry and the sequence non-empty, else it is
 * skipped; the sequence runs to the entry's end. The reference row is the one
 * `refAssemblyName` names, else the queried assembly's, else the column's
 * first entry, read before the sample filter so a reference the filter drops
 * still positions the block.
 */
export class MafTabixBlockReader {
  private resolver
  private anySource = makeSourceResolver()
  private tokens = new Map<string, Token | null>()
  private lastName: string[] = []
  private lastToken: (Token | null)[] = []
  private rows = new RecordSlots()

  private from: number[] = []
  private to: number[] = []
  private chr: string[] = []
  private srcStart: number[] = []
  private strand: number[] = []
  private srcSize: number[] = []

  private refAssemblyName: string | undefined
  private queryAssemblyName: string | undefined

  constructor(
    sampleIds: Set<string> | undefined,
    refAssemblyName: string | undefined,
    queryAssemblyName: string | undefined,
  ) {
    this.resolver = makeSourceResolver(sampleIds)
    this.refAssemblyName = refAssemblyName
    this.queryAssemblyName = queryAssemblyName
  }

  private token(name: string) {
    let token = this.tokens.get(name)
    if (token === undefined) {
      const parsed = this.resolver.resolve(name)
      token = parsed?.assemblyName
        ? { key: this.rows.key(parsed.assemblyName), chr: parsed.chr }
        : null
      this.tokens.set(name, token)
    }
    return token
  }

  // Blocks name their species in the same order, so the entry at the same
  // place as last block's usually has the same name, which a compare in place
  // confirms without a slice or a hash.
  private tokenAt(k: number, text: string, from: number, c0: number) {
    const last = this.lastName[k]
    if (
      last !== undefined &&
      last.length === c0 - from &&
      text.startsWith(last, from)
    ) {
      return this.lastToken[k]!
    }
    const name = text.slice(from, c0)
    const token = this.token(name)
    this.lastName[k] = name
    this.lastToken[k] = token
    return token
  }

  read(
    sink: MafBlockSink,
    id: string,
    start: number,
    end: number,
    text: string,
  ) {
    const rows = this.rows
    rows.startBlock()
    let firstFrom = -1
    let firstTo = -1
    for (let from = 0, k = 0, l = text.length; from < l; k++) {
      let to = text.indexOf(',', from)
      if (to === -1) {
        to = l
      }
      const c0 = text.indexOf(':', from)
      const c1 = c0 === -1 ? -1 : text.indexOf(':', c0 + 1)
      const c2 = c1 === -1 ? -1 : text.indexOf(':', c1 + 1)
      const c3 = c2 === -1 ? -1 : text.indexOf(':', c2 + 1)
      const c4 = c3 === -1 ? -1 : text.indexOf(':', c3 + 1)
      if (
        c0 !== -1 &&
        c0 < to &&
        c0 !== from &&
        c4 !== -1 &&
        c4 < to &&
        c4 + 1 !== to
      ) {
        const token = this.tokenAt(k, text, from, c0)
        if (token) {
          const slot = rows.slot(
            rows.holds(token.key)
              ? rows.key(
                  freeRowId(token.key.name, id => rows.slotOf(id) !== -1),
                )
              : token.key,
          )
          this.from[slot] = c4 + 1
          this.to[slot] = to
          this.chr[slot] = token.chr
          this.srcStart[slot] = parseDecimal(text, c0 + 1, c1)
          this.strand[slot] = text.charCodeAt(c2 + 1) === MINUS ? -1 : 1
          this.srcSize[slot] = parseDecimal(text, c3 + 1, c4)
          if (from === 0) {
            firstFrom = c4 + 1
            firstTo = to
          }
        } else if (
          from === 0 &&
          this.anySource.resolve(text.slice(from, c0))?.assemblyName
        ) {
          firstFrom = c4 + 1
          firstTo = to
        }
      }
      from = to + 1
    }

    let ref = rows.slotOf(this.refAssemblyName)
    if (ref === -1) {
      ref = rows.slotOf(this.queryAssemblyName)
    }
    if (ref !== -1) {
      sink.startBlock(id, start, end, 0, text, this.from[ref]!, this.to[ref]!)
    } else if (firstFrom !== -1) {
      sink.startBlock(id, start, end, 0, text, firstFrom, firstTo)
    } else {
      sink.startBlock(id, start, end, 0, '', 0, 0)
    }
    const order = rows.order()
    for (let j = 0; j < rows.count; j++) {
      const slot = order[j]!
      sink.addRow(
        rows.nameAt(slot),
        text,
        this.from[slot]!,
        this.to[slot]!,
        this.chr[slot]!,
        this.srcStart[slot]!,
        this.strand[slot]!,
        this.srcSize[slot],
        undefined,
      )
    }
  }

  reportUnmatched() {
    this.resolver.reportUnmatched()
  }
}

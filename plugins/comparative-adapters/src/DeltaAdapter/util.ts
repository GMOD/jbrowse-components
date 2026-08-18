import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'

import type { PAFRecord } from '../PAFAdapter/util.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter/types'

/* paf2delta from paftools.js in the minimap2 repository, license reproduced below
 *
 * The MIT License
 *
 * Copyright (c) 2018-     Dana-Farber Cancer Institute
 *               2017-2018 Broad Institute, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
 * BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
 * ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export function paf_delta2paf(buffer: Uint8Array, opts?: BaseOptions) {
  const { statusCallback } = opts ?? {}
  let rname = ''
  let qname = ''
  let qs = 0
  let qe = 0
  let rs = 0
  let re = 0
  let strand = 0
  let NM = 0
  let cigar: number[] = []
  let x = 0
  let y = 0
  let seen_gt = false
  // An alignment is only complete at its `0` terminator, so `open` is what
  // distinguishes "between records" from "mid-record": the file's last
  // alignment used to be dropped without a word when the file was truncated
  // before that terminator.
  let open = false
  let skipped = 0

  const records: PAFRecord[] = []
  const regex = /^>(\S+)\s+(\S+)\s+(\d+)\s+(\d+)/

  // The remaining ungapped run closes the alignment. A record whose offsets do
  // not reconcile with its own header interval is unrenderable, so it is
  // dropped — but only it. This used to throw, and since the throw escaped
  // `paf_delta2paf` a single bad record cost every good one in the file: the
  // track came up empty, saying `inconsistent alignment on line 0`, which names
  // the terminator rather than the record that was wrong.
  function flush() {
    if (!open) {
      return
    }
    open = false
    const rrem = re - rs - x
    const qrem = qe - qs - y
    if (rrem !== qrem || rrem < 0) {
      skipped++
      return
    }
    let blen = 0
    const cigar_str = []
    cigar.push(rrem << 4)
    for (const entry of cigar) {
      const rlen = entry >> 4
      blen += rlen
      cigar_str.push(rlen + 'MID'.charAt(entry & 0xf))
    }

    records.push({
      qname,
      qstart: qs,
      qend: qe,
      tname: rname,
      tstart: rs,
      tend: re,
      strand,
      // No mappingQual: a delta file carries no mapping quality, and
      // emitting 0 made every alignment read as MAPQ 0 ("multi-mapping")
      // in the MAPQ color ramp and group-by rather than "unavailable".
      extra: {
        numMatches: blen - NM,
        blockLen: blen,
        NM,
        cg: cigar_str.join(''),
      },
    })
  }

  parseLineByLine(
    buffer,
    line => {
      const m = regex.exec(line)
      if (m !== null) {
        // a well-formed file has already flushed at the previous `0`; this
        // catches an alignment cut short by the next header
        flush()
        rname = m[1]!
        qname = m[2]!
        seen_gt = true
        return true
      }
      if (!seen_gt) {
        return true
      }
      const t = line.split(' ')
      if (t.length === 7) {
        const t0 = +t[0]!
        const t1 = +t[1]!
        const t2 = +t[2]!
        const t3 = +t[3]!
        const t4 = +t[4]!
        // Compared as a pair of directions rather than two strict-inequality
        // clauses, which both went false on a single-base alignment (t0 === t1)
        // and reported a forward match as reverse.
        strand = t0 <= t1 === t2 <= t3 ? 1 : -1
        rs = Math.min(t0, t1) - 1
        re = Math.max(t1, t0)
        qs = Math.min(t2, t3) - 1
        qe = Math.max(t3, t2)
        x = y = 0
        NM = t4
        cigar = []
        open = true
      } else if (t.length === 1 && open) {
        const d = +t[0]!
        // Anything that is neither a 7-column header nor an integer offset is a
        // line this parser does not understand. Falling through to the offset
        // branch turned it into a NaN that rode into the CIGAR and surfaced
        // much later as the record failing to reconcile.
        if (!Number.isInteger(d)) {
          return true
        }
        if (d === 0) {
          flush()
        } else if (d > 0) {
          const l = d - 1
          x += l + 1
          y += l
          if (l > 0) {
            cigar.push(l << 4)
          }

          if (cigar.length > 0 && (cigar[cigar.length - 1]! & 0xf) === 2) {
            cigar[cigar.length - 1]! += 1 << 4
          } else {
            cigar.push((1 << 4) | 2)
          } // deletion
        } else {
          const l = -d - 1
          x += l
          y += l + 1
          if (l > 0) {
            cigar.push(l << 4)
          }

          if (cigar.length > 0 && (cigar[cigar.length - 1]! & 0xf) === 1) {
            cigar[cigar.length - 1]! += 1 << 4
          } else {
            cigar.push((1 << 4) | 1)
          } // insertion
        }
      }
      return true
    },
    statusCallback,
    { label: 'Parsing delta', stopToken: opts?.stopToken },
  )
  // the file's last alignment, when it was truncated before its `0`
  flush()
  if (skipped) {
    console.warn(
      `DeltaAdapter: skipped ${skipped} alignment(s) whose indel offsets do not reconcile with their own header interval`,
    )
  }
  return records
}

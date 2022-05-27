import type { Buffer } from 'buffer'

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

export function paf_delta2paf(buffer: Buffer) {
  let rname = ''
  let qname = ''
  let qs = 0
  let qe = 0
  let rs = 0
  let re = 0
  let strand = 0
  let NM = 0
  let cigar = [] as number[]
  let x = 0
  let y = 0
  let seen_gt = false

  const records = []
  const regex = new RegExp(/^>(\S+)\s+(\S+)\s+(\d+)\s+(\d+)/)

  let blockStart = 0
  let i = 0
  const decoder = new TextDecoder('utf8')
  while (blockStart < buffer.length) {
    const n = buffer.indexOf('\n', blockStart)
    if (n === -1) {
      break
    }
    const b = buffer.subarray(blockStart, n)
    const line = decoder.decode(b).trim()
    blockStart = n + 1
    i++
    if (line) {
      const m = regex.exec(line)
      if (m !== null) {
        rname = m[1]!
        qname = m[2]!
        seen_gt = true
        continue
      }
      if (!seen_gt) {
        continue
      }
      const t = line.split(' ')
      if (t.length === 7) {
        const t0 = +t[0]!
        const t1 = +t[1]!
        const t2 = +t[2]!
        const t3 = +t[3]!
        const t4 = +t[4]!
        strand = (t0 < t1 && t2 < t3) || (t0 > t1 && t2 > t3) ? 1 : -1
        rs = +Math.min(t0, t1) - 1
        re = +Math.max(t1, t0)
        qs = +Math.min(t2, t3) - 1
        qe = +Math.max(t3, t2)
        x = y = 0
        NM = t4
        cigar = []
      } else if (t.length === 1) {
        const d = +t[0]!
        if (d === 0) {
          let blen = 0
          const cigar_str = []

          if (re - rs - x !== qe - qs - y) {
            throw new Error(`inconsistent alignment on line ${i}`)
          }
          cigar.push((re - rs - x) << 4)
          for (const entry of cigar) {
            const rlen = entry >> 4
            blen += rlen
            cigar_str.push(rlen + 'MID'.charAt(cigar[i]! & 0xf))
          }

          records.push({
            qname,
            qstart: qs,
            qend: qe,
            tname: rname,
            tstart: rs,
            tend: re,
            strand,
            extra: {
              numMatches: blen - NM,
              blockLen: blen,
              mappingQual: 0,
              NM,
              cg: cigar_str.join(''),
            },
          })
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
    }
  }
  return records
}

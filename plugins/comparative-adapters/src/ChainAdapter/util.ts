/* adapted from chain2paf by Andrea Guarracino, license reproduced below
 *
 * MIT License
 *
 * Copyright (c) 2021 Andrea Guarracino
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { getProgressDisplayStr } from '@jbrowse/core/util'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

function generate_record(
  qname: string,
  qstart: number,
  qend: number,
  qstrand: string,
  tname: string,
  tstart: number,
  tend: number,
  cigar: string,
  numMatches: number,
) {
  return {
    qname,
    qstart,
    qend,
    tname,
    tstart,
    tend,
    strand: qstrand === '-' ? -1 : 1,
    extra: {
      numMatches,
      blockLen: Math.max(qend - qstart, tend - tstart),
      mappingQual: 0,
      cg: cigar,
    },
  }
}

export function paf_chain2paf(buffer: Uint8Array, opts?: BaseOptions) {
  const { statusCallback = () => {} } = opts || {}
  const decoder = new TextDecoder('utf8')
  const records = [] as ReturnType<typeof generate_record>[]

  let t_name = ''
  let t_start = 0
  let t_end = 0
  let q_name = ''
  let q_size = 0
  let q_strand = ''
  let q_start = 0
  let q_end = 0
  let num_matches = 0
  let cigar = ''

  let blockStart = 0
  let lineIndex = 0

  while (blockStart < buffer.length) {
    const n = buffer.indexOf(10, blockStart)
    const lineEnd = n === -1 ? buffer.length : n

    let realEnd = lineEnd
    while (
      realEnd > blockStart &&
      (buffer[realEnd - 1] === 13 || buffer[realEnd - 1] === 32)
    ) {
      realEnd--
    }
    let realStart = blockStart
    while (
      realStart < realEnd &&
      (buffer[realStart] === 32 || buffer[realStart] === 9)
    ) {
      realStart++
    }

    if (realStart < realEnd && buffer[realStart] !== 35) {
      if (buffer[realStart] === 99) {
        const line = decoder.decode(buffer.subarray(realStart, realEnd))
        const l_vec = line.split(/[ \t]+/)
        if (l_vec[0] === 'chain') {
          if (cigar) {
            records.push(
              generate_record(
                q_name,
                q_start,
                q_end,
                q_strand,
                t_name,
                t_start,
                t_end,
                cigar,
                num_matches,
              ),
            )
          }

          t_name = l_vec[2]!
          t_start = +l_vec[5]!
          t_end = +l_vec[6]!
          q_name = l_vec[7]!
          q_size = +l_vec[8]!
          q_strand = l_vec[9]!
          q_start = +l_vec[10]!
          q_end = +l_vec[11]!
          if (q_strand === '-') {
            const tmp = q_start
            q_start = q_size - q_end
            q_end = q_size - tmp
          }

          num_matches = 0
          cigar = ''
        }
      } else {
        let pos = realStart
        let size = 0
        while (pos < realEnd && buffer[pos]! >= 48 && buffer[pos]! <= 57) {
          size = size * 10 + buffer[pos]! - 48
          pos++
        }
        if (size !== 0) {
          num_matches += size
          cigar += `${size}M`
        }
        while (pos < realEnd && (buffer[pos] === 32 || buffer[pos] === 9)) {
          pos++
        }
        let dt = 0
        while (pos < realEnd && buffer[pos]! >= 48 && buffer[pos]! <= 57) {
          dt = dt * 10 + buffer[pos]! - 48
          pos++
        }
        while (pos < realEnd && (buffer[pos] === 32 || buffer[pos] === 9)) {
          pos++
        }
        let dq = 0
        while (pos < realEnd && buffer[pos]! >= 48 && buffer[pos]! <= 57) {
          dq = dq * 10 + buffer[pos]! - 48
          pos++
        }
        if (dq !== 0) {
          cigar += `${dq}I`
        }
        if (dt !== 0) {
          cigar += `${dt}D`
        }
      }
    }

    if (lineIndex++ % 10_000 === 0) {
      statusCallback(
        `Loading ${getProgressDisplayStr(blockStart, buffer.length)}`,
      )
    }
    blockStart = lineEnd + 1
  }

  if (cigar) {
    records.push(
      generate_record(
        q_name,
        q_start,
        q_end,
        q_strand,
        t_name,
        t_start,
        t_end,
        cigar,
        num_matches,
      ),
    )
  }

  statusCallback('')
  return records
}

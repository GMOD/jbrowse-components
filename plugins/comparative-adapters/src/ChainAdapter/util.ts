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

import { createProgressReporter } from '@jbrowse/core/util'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

function generateRecord(
  qname: string,
  qstart: number,
  qend: number,
  qstrand: string,
  tname: string,
  tstart: number,
  tend: number,
  cigarParts: string[],
  numMatches: number,
  ins: number,
  del: number,
) {
  // A chain header states the interval; the block list refines it. The two can
  // disagree — a lossy PAF→chain conversion writes one block of the query
  // length and drops the target gap entirely, which is 215 of the 278 chains in
  // the yeast demo track, off by up to 20kb. Padding the shortfall keeps the
  // CIGAR spanning the coordinates the same record reports, so the synteny
  // sub-blocks fill the band they are drawn inside. The delta parser asserts
  // this same invariant; here it is repaired rather than thrown on, because one
  // bad chain should not cost the file.
  const padD = tend - tstart - (numMatches + del)
  const padI = qend - qstart - (numMatches + ins)
  if (padI > 0) {
    cigarParts.push(`${padI}I`)
  }
  if (padD > 0) {
    cigarParts.push(`${padD}D`)
  }
  return {
    qname,
    qstart,
    qend,
    tname,
    tstart,
    tend,
    strand: qstrand === '-' ? -1 : 1,
    // No mappingQual: a chain file carries no mapping quality, and emitting 0
    // made every alignment read as MAPQ 0 ("multi-mapping") in the MAPQ color
    // ramp and group-by rather than "unavailable".
    extra: {
      numMatches,
      // M+I+D, the PAF definition, so identity means the same thing whichever
      // format an alignment arrived in. `max(qspan, tspan)` undercounted the
      // denominator by min(I,D) and read as extra identity on a third of the
      // records in a real liftOver chain, up to +0.17.
      blockLen: numMatches + ins + del + Math.max(padI, 0) + Math.max(padD, 0),
      cg: cigarParts.join(''),
    },
  }
}

export function paf_chain2paf(buffer: Uint8Array, opts?: BaseOptions) {
  const { statusCallback, stopToken } = opts ?? {}
  const decoder = new TextDecoder('utf8')
  // Time-gated rather than the old every-500kB byte gate, and it carries the
  // stop-token check, so a multi-GB chain is both labelled and interruptible.
  const report = createProgressReporter({
    label: 'Parsing chain',
    total: buffer.length,
    statusCallback,
    stopToken,
  })
  const records: ReturnType<typeof generateRecord>[] = []

  let t_name = ''
  let t_start = 0
  let t_end = 0
  let q_name = ''

  let q_size: number
  let q_strand = ''
  let q_start = 0
  let q_end = 0
  let num_matches = 0
  let ins = 0
  let del = 0
  let cigarParts: string[] = []
  // Data lines before the first header belong to no chain. Flushing them
  // emitted a record with an empty refName and a zero-length span — a phantom
  // feature on a contig that does not exist.
  let seenHeader = false

  let blockStart = 0

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
          if (seenHeader && cigarParts.length) {
            records.push(
              generateRecord(
                q_name,
                q_start,
                q_end,
                q_strand,
                t_name,
                t_start,
                t_end,
                cigarParts,
                num_matches,
                ins,
                del,
              ),
            )
          }
          seenHeader = true

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
          ins = 0
          del = 0
          cigarParts = []
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
          cigarParts.push(`${size}M`)
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
          ins += dq
          cigarParts.push(`${dq}I`)
        }
        if (dt !== 0) {
          del += dt
          cigarParts.push(`${dt}D`)
        }
      }
    }

    report(blockStart)
    blockStart = lineEnd + 1
  }

  if (seenHeader && cigarParts.length) {
    records.push(
      generateRecord(
        q_name,
        q_start,
        q_end,
        q_strand,
        t_name,
        t_start,
        t_end,
        cigarParts,
        num_matches,
        ins,
        del,
      ),
    )
  }

  statusCallback?.('')
  return records
}

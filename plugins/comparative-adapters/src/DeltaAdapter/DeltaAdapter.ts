import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { NoAssemblyRegion, Region } from '@jbrowse/core/util/types'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import { unzip } from '@gmod/bgzf-filehandle'

interface PafRecord {
  records: NoAssemblyRegion[]
  extra: {
    blockLen: number
    mappingQual: number
    numMatches: number
    strand: number
  }
}

function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

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

function paf_delta2paf(lines: string[]) {
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
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = regex.exec(line)
    if (m !== null) {
      rname = m[1]
      qname = m[2]
      seen_gt = true
      continue
    }
    if (!seen_gt) {
      continue
    }
    const t = line.split(' ')
    if (t.length === 7) {
      const t0 = +t[0]
      const t1 = +t[1]
      const t2 = +t[2]
      const t3 = +t[3]
      const t4 = +t[4]
      strand = (t0 < t1 && t2 < t3) || (t0 > t1 && t2 > t3) ? 1 : -1
      rs = +(t0 < t1 ? t0 : t1) - 1
      re = +(t1 > t0 ? t1 : t0)
      qs = +(t2 < t3 ? t2 : t3) - 1
      qe = +(t3 > t2 ? t3 : t2)
      x = y = 0
      NM = t4
      cigar = []
    } else if (t.length === 1) {
      const d = +t[0]
      if (d === 0) {
        let blen = 0
        const cigar_str = []

        if (re - rs - x !== qe - qs - y) {
          throw new Error(`inconsistent alignment on line ${i}`)
        }
        cigar.push((re - rs - x) << 4)
        for (let i = 0; i < cigar.length; ++i) {
          blen += cigar[i] >> 4
          cigar_str.push((cigar[i] >> 4) + 'MID'.charAt(cigar[i] & 0xf))
        }

        records.push({
          records: [
            { refName: qname, start: qs, end: qe },
            { refName: rname, start: rs, end: re },
          ],
          extra: {
            numMatches: blen - NM,
            blockLen: blen,
            strand,
            mappingQual: 0,
            NM,
            cg: cigar_str.join(''),
          },
        } as PafRecord)
      } else if (d > 0) {
        const l = d - 1
        x += l + 1
        y += l
        if (l > 0) {
          cigar.push(l << 4)
        }
        if (cigar.length > 0 && (cigar[cigar.length - 1] & 0xf) === 2) {
          cigar[cigar.length - 1] += 1 << 4
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
        if (cigar.length > 0 && (cigar[cigar.length - 1] & 0xf) === 1) {
          cigar[cigar.length - 1] += 1 << 4
        } else {
          cigar.push((1 << 4) | 1)
        } // insertion
      }
    }
  }
  return records
}

export default class DeltaAdapter extends BaseFeatureDataAdapter {
  private setupP?: Promise<PafRecord[]>

  public static capabilities = ['getFeatures', 'getRefNames']

  async setup(opts?: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.setupPre(opts).catch(e => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  async setupPre(opts?: BaseOptions) {
    const deltaLocation = openLocation(
      readConfObject(this.config, 'deltaLocation'),
      this.pluginManager,
    )
    const buffer = (await deltaLocation.readFile(opts)) as Buffer
    const buf = isGzip(buffer) ? await unzip(buffer) : buffer
    // 512MB  max chrome string length is 512MB
    if (buf.length > 536_870_888) {
      throw new Error('Data exceeds maximum string length (512MB)')
    }
    const text = new TextDecoder('utf8', { fatal: true }).decode(buf)

    return paf_delta2paf(text.split('\n').filter(line => !!line))
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures
    // so is not really that important, and has to be true or else
    // getFeatures is never called (BaseAdapter filters it out)
    return true
  }

  async getRefNames() {
    // we cannot determine this accurately
    return []
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const pafRecords = await this.setup(opts)
      const assemblyNames = readConfObject(this.config, 'assemblyNames')

      // The index of the assembly name in the region list corresponds to
      // the adapter in the subadapters list
      const index = assemblyNames.indexOf(region.assemblyName)
      if (index !== -1) {
        for (let i = 0; i < pafRecords.length; i++) {
          const { extra, records } = pafRecords[i]
          const { start, end, refName } = records[index]
          if (
            refName === region.refName &&
            doesIntersect2(region.start, region.end, start, end)
          ) {
            observer.next(
              new SimpleFeature({
                uniqueId: `row_${i}`,
                start,
                end,
                refName,
                syntenyId: i,
                mate: {
                  start: records[+!index].start,
                  end: records[+!index].end,
                  refName: records[+!index].refName,
                },
                ...extra,
              }),
            )
          }
        }
      }

      observer.complete()
    })
  }

  freeResources(/* { region } */): void {}
}

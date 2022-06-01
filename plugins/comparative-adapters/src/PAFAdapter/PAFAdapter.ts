import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { unzip } from '@gmod/bgzf-filehandle'

export interface PAFRecord {
  qname: string
  qstart: number
  qend: number
  tname: string
  tstart: number
  tend: number
  strand: number
  extra: {
    blockLen?: number
    mappingQual: number
    numMatches?: number
    meanScore?: number
  }
}

function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

function zip(a: number[], b: number[]) {
  return a.map((e, i) => [e, b[i]] as [number, number])
}

// based on "weighted mean" method from dotPlotly
// https://github.com/tpoorten/dotPlotly
// License for dotPlotly reproduced here
//
// MIT License

// Copyright (c) 2017 Tom Poorten

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

function getWeightedMeans(ret: PAFRecord[]) {
  // in the weighted mean longer alignments factor in more
  // heavily of all the fragments of a query vs the reference that it mapped
  // to
  //
  // this uses a combined key query+'-'+ref to iteratively map all the
  // alignments that match a particular ref from a particular query (so 1d
  // array of what could be a 2d map)
  //
  // the result is a single number that says e.g. chr5 from human mapped to
  // chr5 on mouse with 0.8 quality, and that0.8 is then attached to all the
  // pieces of chr5 on human that mapped to chr5 on mouse. if chr5 on human
  // also more weakly mapped to chr6 on mouse, then it would have another
  // value e.g. 0.6. this can show strong and weak levels of synteny,
  // especially in polyploidy situations
  const scoreMap: { [key: string]: { quals: number[]; len: number[] } } = {}
  for (let i = 0; i < ret.length; i++) {
    const entry = ret[i]
    const query = entry.qname
    const target = entry.tname
    const key = query + '-' + target
    if (!scoreMap[key]) {
      scoreMap[key] = { quals: [], len: [] }
    }
    scoreMap[key].quals.push(entry.extra.mappingQual)
    scoreMap[key].len.push(entry.extra.blockLen || 1)
  }

  const meanScoreMap = Object.fromEntries(
    Object.entries(scoreMap).map(([key, val]) => {
      const vals = zip(val.quals, val.len)
      return [key, weightedMean(vals)]
    }),
  )
  for (let i = 0; i < ret.length; i++) {
    const entry = ret[i]
    const query = entry.qname
    const target = entry.tname
    const key = query + '-' + target
    entry.extra.meanScore = meanScoreMap[key]
  }

  let min = 10000
  let max = 0
  for (let i = 0; i < ret.length; i++) {
    const entry = ret[i]
    min = Math.min(entry.extra.meanScore || 0, min)
    max = Math.max(entry.extra.meanScore || 0, max)
  }
  for (let i = 0; i < ret.length; i++) {
    const entry = ret[i]
    const b = entry.extra.meanScore || 0
    entry.extra.meanScore = (b - min) / (max - min)
  }

  return ret
}

// https://gist.github.com/stekhn/a12ed417e91f90ecec14bcfa4c2ae16a
function weightedMean(tuples: [number, number][]) {
  const [valueSum, weightSum] = tuples.reduce(
    ([valueSum, weightSum], [value, weight]) => [
      valueSum + value * weight,
      weightSum + weight,
    ],
    [0, 0],
  )
  return valueSum / weightSum
}

export default class PAFAdapter extends BaseFeatureDataAdapter {
  private setupP?: Promise<PAFRecord[]>

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
    const pafLocation = openLocation(
      this.getConf('pafLocation'),
      this.pluginManager,
    )
    const buffer = (await pafLocation.readFile(opts)) as Buffer
    const buf = isGzip(buffer) ? await unzip(buffer) : buffer
    // 512MB  max chrome string length is 512MB
    if (buf.length > 536_870_888) {
      throw new Error('Data exceeds maximum string length (512MB)')
    }
    const text = new TextDecoder('utf8', { fatal: true }).decode(buf)

    return getWeightedMeans(
      text
        .split('\n')
        .filter(line => !!line)
        .map(line => {
          const [
            qname,
            ,
            qstart,
            qend,
            strand,
            tname,
            ,
            tstart,
            tend,
            numMatches,
            blockLen,
            mappingQual,
            ...fields
          ] = line.split('\t')

          const rest = Object.fromEntries(
            fields.map(field => {
              const r = field.indexOf(':')
              const fieldName = field.slice(0, r)
              const fieldValue = field.slice(r + 3)
              return [fieldName, fieldValue]
            }),
          )

          return {
            tname,
            tstart: +tstart,
            tend: +tend,
            qname,
            qstart: +qstart,
            qend: +qend,
            strand: strand === '-' ? -1 : 1,
            extra: {
              numMatches: +numMatches,
              blockLen: +blockLen,
              mappingQual: +mappingQual,
              ...rest,
            },
          } as PAFRecord
        }),
    )
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures
    // so is not really that important, and has to be true or else
    // getFeatures is never called (BaseAdapter filters it out)
    return true
  }

  getAssemblyNames() {
    let assemblyNames = this.getConf('assemblyNames') as string[]
    if (assemblyNames.length === 0) {
      const query = this.getConf('queryAssembly') as string
      const target = this.getConf('targetAssembly') as string
      assemblyNames = [query, target]
    }
    return assemblyNames
  }

  async getRefNames(opts: BaseOptions = {}) {
    // @ts-ignore
    const r1 = opts.regions?.[0].assemblyName
    const feats = await this.setup()

    const idx = this.getAssemblyNames().indexOf(r1)
    if (idx !== -1) {
      const set = new Set<string>()
      for (let i = 0; i < feats.length; i++) {
        const f = feats[i]
        if (idx === 0) {
          set.add(f.qname)
        } else {
          set.add(f.tname)
        }
      }
      return Array.from(set)
    }
    console.warn('Unable to do ref renaming on adapter')
    return []
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const pafRecords = await this.setup(opts)
      const assemblyNames = this.getAssemblyNames()
      const { assemblyName } = region

      // The index of the assembly name in the region list corresponds to the
      // adapter in the subadapters list
      const index = assemblyNames.indexOf(assemblyName)
      if (index !== -1) {
        for (let i = 0; i < pafRecords.length; i++) {
          const r = pafRecords[i]
          let start = 0
          let end = 0
          let refName = ''
          let mateName = ''
          let mateStart = 0
          let mateEnd = 0
          if (index === 0) {
            start = r.qstart
            end = r.qend
            refName = r.qname
            mateName = r.tname
            mateStart = r.tstart
            mateEnd = r.tend
          } else {
            start = r.tstart
            end = r.tend
            refName = r.tname
            mateName = r.qname
            mateStart = r.qstart
            mateEnd = r.qend
          }
          const { extra, strand } = r

          if (
            refName === region.refName &&
            doesIntersect2(region.start, region.end, start, end)
          ) {
            observer.next(
              new SimpleFeature({
                uniqueId: `${i}`,
                start,
                end,
                refName,
                strand,
                assemblyName,
                syntenyId: i,
                mate: { start: mateStart, end: mateEnd, refName: mateName },
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

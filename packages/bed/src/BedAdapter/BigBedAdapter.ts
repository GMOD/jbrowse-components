/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigBed } from '@gmod/bbi'
import BED from '@gmod/bed'
import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation, IRegion } from '@gmod/jbrowse-core/mst-types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { Observable, Observer } from 'rxjs'
import { map, mergeAll } from 'rxjs/operators'

interface BEDFeature {
  chrom: string
  chromStart: number
  chromEnd: number
  [key: string]: any
}
interface AlreadyRegularizedFeature {
  refName: string
  start: number
  end: number
}
interface RegularizedFeature {
  refName: string
  start: number
  end: number
}
interface Parser {
  parseLine: (line: string, opts: { uniqueId: string | number }) => BEDFeature
}

const bed_feature_names = 'seq_id start end name score strand'.split(' ')
class BEDParser {
  private featureCallback: Function

  private endCallback: Function

  private commentCallback: Function

  private errorCallback: Function

  private store: any

  private eof: boolean

  public header: { [key: string]: any }

  constructor(args: any) {
    this.featureCallback = args.featureCallback || function() {}
    this.endCallback = args.endCallback || function() {}
    this.commentCallback = args.commentCallback || function() {}
    this.headerCallback = args.headerCallback || function() {}
    this.errorCallback =
      args.errorCallback ||
      function(e: Error) {
        console.error(e)
      }
    this.store = args.store
    // if this is true, the parser ignores the
    // rest of the lines in the file.  currently
    // set when the file switches over to FASTA
    this.eof = false
    this.header = {}
  }

  /**
   * Parse the bytes that contain the BED header, storing the parsed
   * data in this.header.
   */
  parseHeader(lines: string[]) {
    // parse the header lines
    const headData: { [key: string]: any } = {}
    let line
    for (let i = 0; i < lines.length; i++) {
      // only interested in meta and header lines
      // eslint-disable-next-line no-continue
      if (
        line[0] === '#' ||
        line.startsWith('browser') ||
        line.startsWith('track')
      ) {
        /// some custom header, pass to parser
        const { key, value } = this.headerCallback(line) || {}
        this.header[key] = value
      }

      // parse meta line using the parseHeader configuration callback function
    }

    return headData
  }

  finish() {
    this.endCallback()
  }

  addLine(line: string) {
    let match
    if (this.eof) {
      // do nothing
    } else if (/^\s*[^#\s>]/.test(line)) {
      // < feature line, most common case
      line = line.replace(/\r?\n?$/g, '')
      const f = this.parse_feature(line)
      this.featureCallback(this._return_item([f]))
    }
    // directive or comment
    else if ((match = /^\s*(\#+)(.*)/.exec(line))) {
      const hashsigns = match[1]
      let contents = match[2]
      contents = contents.replace(/\s*/, '')
      this._return_item({ comment: contents })
    } else if (/^\s*$/.test(line)) {
      // blank line, do nothing
    } else {
      // it's a parse error
      line = line.replace(/\r?\n?$/g, '')
      throw `BED parse error.  Cannot parse '${line}'.`
    }
  }

  unescape(s: string) {
    if (s === null) return null

    return s.replace(/%([0-9A-Fa-f]{2})/g, function(match, seq) {
      return String.fromCharCode(parseInt(seq, 16))
    })
  }

  parse_feature(line: string) {
    const f = line.split('\t').map(function(a) {
      if (a == '.') {
        return null
      }
      return a
    })

    // unescape only the ref and source columns
    f[0] = this.unescape(f[0])

    const parsed = {}
    for (let i = 0; i < bed_feature_names.length; i++) {
      if (f[i]) {
        parsed[bed_feature_names[i]] = f[i] == '.' ? null : f[i]
      }
    }
    if (parsed.start !== null) parsed.start = parseInt(parsed.start, 10)
    if (parsed.end !== null) parsed.end = parseInt(parsed.end, 10)
    if (parsed.score != null) parsed.score = parseFloat(parsed.score, 10)

    parsed.strand = { '+': 1, '-': -1 }[parsed.strand] || 0

    return parsed
  }

  _return_item(i) {
    if (i[0]) this.featureCallback(i)
    else if (i.comment) this.commentCallback(i, this.store)
  }
}

export default class extends BaseAdapter {
  private bed: any

  private parser: Parser

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: { bedLocation: IFileLocation; autoSql: string }) {
    super()

    const { bedLocation, autoSql } = config
    this.parser = new BED({ autoSql })
    this.bed = this.parseBed(bedLocation)
  }

  async parseBed(bedLocation: IFileLocation) {
    return ((await openLocation(bedLocation).readFile('utf8')) as string)
      .split('\n')
      .map((row, index) => {
        this.parser.parseLine(row, { uniqueId: `row${index}` })
      })
  }

  public async getRefNames() {
    const bed = await this.bed
    const refSeqs = new Set<string>()
    bed.forEach((row: any) => {
      refSeqs.add(row.refName)
    })

    return Array.from(refSeqs)
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @param abortSignal an abortSignal
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures(
    region: IRegion,
    opts: BaseOptions = {},
  ): Observable<Feature> {
    const { refName, start, end } = region
    const { signal } = opts
    return ObservableCreate(async (observer: Observer<Feature>) => {
      try {
        const parser = await this.parser
        const ob = await this.bigbed.getFeatureStream(refName, start, end, {
          signal,
          basesPerSpan: end - start,
        })
        ob.pipe(
          mergeAll(),
          map(
            (r: {
              start: number
              end: number
              rest: string
              refName: string
              uniqueId: number
            }) => {
              const data = parser.parseLine(
                `${refName}\t${r.start}\t${r.end}\t${r.rest}`,
                {
                  uniqueId: r.uniqueId,
                },
              )

              const { blockCount, blockSizes, blockStarts, chromStarts } = data

              if (blockCount) {
                const starts = chromStarts || blockStarts || []
                const sizes = blockSizes
                const blocksOffset = r.start
                data.subfeatures = []

                for (let b = 0; b < blockCount; b += 1) {
                  const bmin = (starts[b] || 0) + blocksOffset
                  const bmax = bmin + (sizes[b] || 0)
                  data.subfeatures.push({
                    uniqueId: `${r.uniqueId}-${b}`,
                    start: bmin,
                    end: bmax,
                    type: 'block',
                  })
                }
              }
              const f = new SimpleFeature({
                id: r.uniqueId,
                data: {
                  ...data,
                  start: r.start,
                  end: r.end,
                  refName,
                },
              })
              return f.get('thickStart') ? ucscProcessedTranscript(f) : f
            },
          ),
        ).subscribe(observer)
      } catch (e) {
        observer.error(e)
      }
    })
  }

  public freeResources(): void {}
}

function ucscProcessedTranscript(feature: Feature) {
  const children = feature.children()
  // split the blocks into UTR, CDS, and exons
  const thickStart = feature.get('thickStart')
  const thickEnd = feature.get('thickEnd')

  if (!thickStart && !thickEnd) return feature

  const blocks: Feature[] = children
    ? children
        .filter(child => child.get('type') === 'block')
        .sort((a, b) => a.get('start') - b.get('start'))
    : []
  const newChildren: Record<string, any> = []
  blocks.forEach((block, index) => {
    const start = block.get('start')
    const end = block.get('end')
    if (thickStart >= end) {
      // left-side UTR
      const prime = feature.get('strand') > 0 ? 'five' : 'three'
      newChildren.push({
        type: `${prime}_prime_UTR`,
        start,
        end,
      })
    } else if (thickStart > start && thickStart < end && thickEnd >= end) {
      // UTR | CDS
      const prime = feature.get('strand') > 0 ? 'five' : 'three'
      newChildren.push(
        {
          type: `${prime}_prime_UTR`,
          start,
          end: thickStart,
        },
        {
          type: 'CDS',
          start: thickStart,
          end,
        },
      )
    } else if (thickStart <= start && thickEnd >= end) {
      // CDS
      newChildren.push({
        type: 'CDS',
        start,
        end,
      })
    } else if (thickStart > start && thickStart < end && thickEnd < end) {
      // UTR | CDS | UTR
      const leftPrime = feature.get('strand') > 0 ? 'five' : 'three'
      const rightPrime = feature.get('strand') > 0 ? 'three' : 'five'
      newChildren.push(
        {
          type: `${leftPrime}_prime_UTR`,
          start,
          end: thickStart,
        },
        {
          type: `CDS`,
          start: thickStart,
          end: thickEnd,
        },
        {
          type: `${rightPrime}_prime_UTR`,
          start: thickEnd,
          end,
        },
      )
    } else if (thickStart <= start && thickEnd > start && thickEnd < end) {
      // CDS | UTR
      const prime = feature.get('strand') > 0 ? 'three' : 'five'
      newChildren.push(
        {
          type: `CDS`,
          start,
          end: thickEnd,
        },
        {
          type: `${prime}_prime_UTR`,
          start: thickEnd,
          end,
        },
      )
    } else if (thickEnd <= start) {
      // right-side UTR
      const prime = feature.get('strand') > 0 ? 'three' : 'five'
      newChildren.push({
        type: `${prime}_prime_UTR`,
        start,
        end,
      })
    }
  })
  const newData: Record<string, any> = {}
  feature.tags().forEach(tag => {
    newData[tag] = feature.get(tag)
  })
  newData.subfeatures = newChildren
  newData.type = 'mRNA'
  newData.uniqueId = feature.id()
  delete newData.chromStarts
  delete newData.chromStart
  delete newData.chromEnd
  delete newData.chrom
  delete newData.blockSizes
  delete newData.blockCount
  delete newData.thickStart
  delete newData.thickEnd
  const newFeature = new SimpleFeature({
    data: newData,
    id: feature.id(),
  })
  return newFeature
}

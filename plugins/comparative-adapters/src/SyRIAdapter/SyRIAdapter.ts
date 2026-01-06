import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import SyntenyFeature from '../SyntenyFeature/index.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

// SyRI annotation types that represent actual alignments (end with "AL")
// These are the rows we want to display as synteny features
const ALIGNMENT_TYPES = new Set([
  'SYNAL',    // Syntenic alignment
  'INVAL',    // Inverted alignment
  'TRANSAL',  // Translocated alignment
  'DUPAL',    // Duplicated alignment
  'INVDPAL',  // Inverted duplicated alignment
  'INVTRAL',  // Inverted translocated alignment
])

// Map SyRI annotation types to our syriType colors
const TYPE_MAPPING: Record<string, string> = {
  'SYNAL': 'SYN',
  'INVAL': 'INV',
  'TRANSAL': 'TRANS',
  'DUPAL': 'DUP',
  'INVDPAL': 'DUP',
  'INVTRAL': 'TRANS',
}

interface SyRIRecord {
  refName: string
  refStart: number
  refEnd: number
  queryName: string
  queryStart: number
  queryEnd: number
  uniqueId: string
  parentId: string
  annotationType: string
  syriType: string
  copyStatus: string
  strand: number
}

function parseSyRILine(line: string): SyRIRecord | undefined {
  const fields = line.split('\t')
  if (fields.length < 11) {
    return undefined
  }

  const [
    refName,
    refStartStr,
    refEndStr,
    _strand1,
    _strand2,
    queryName,
    queryStartStr,
    queryEndStr,
    uniqueId,
    parentId,
    annotationType,
    copyStatus = '-',
  ] = fields

  // Skip non-alignment rows (we only want the actual alignments)
  if (!ALIGNMENT_TYPES.has(annotationType!)) {
    return undefined
  }

  // Skip rows without query coordinates
  if (queryName === '-' || queryStartStr === '-' || queryEndStr === '-') {
    return undefined
  }

  const refStart = Number.parseInt(refStartStr!, 10)
  const refEnd = Number.parseInt(refEndStr!, 10)
  const queryStart = Number.parseInt(queryStartStr!, 10)
  const queryEnd = Number.parseInt(queryEndStr!, 10)

  // Determine strand based on annotation type (INV types are reverse strand)
  const isInverted = annotationType!.startsWith('INV')
  const strand = isInverted ? -1 : 1

  return {
    refName: refName!,
    refStart: refStart - 1, // Convert from 1-based to 0-based
    refEnd,
    queryName: queryName!,
    queryStart: queryStart - 1, // Convert from 1-based to 0-based
    queryEnd,
    uniqueId: uniqueId!,
    parentId: parentId!,
    annotationType: annotationType!,
    syriType: TYPE_MAPPING[annotationType!] || 'SYN',
    copyStatus: copyStatus!,
    strand,
  }
}

export default class SyRIAdapter extends BaseFeatureDataAdapter {
  private setupP?: Promise<SyRIRecord[]>

  public static capabilities = ['getFeatures', 'getRefNames']

  async setup(opts?: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.setupPre(opts).catch((e: unknown) => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  async setupPre(opts?: BaseOptions) {
    const records: SyRIRecord[] = []
    parseLineByLine(
      await fetchAndMaybeUnzip(
        openLocation(this.getConf('syriLocation'), this.pluginManager),
        opts,
      ),
      line => {
        // Skip empty lines and comments
        if (!line || line.startsWith('#')) {
          return true
        }
        const record = parseSyRILine(line)
        if (record) {
          records.push(record)
        }
        return true
      },
      opts?.statusCallback,
    )
    return records
  }

  async hasDataForRefName() {
    return true
  }

  getAssemblyNames(): string[] {
    const assemblyNames = this.getConf('assemblyNames') as string[]
    if (assemblyNames.length === 0) {
      const target = this.getConf('targetAssembly') as string
      const query = this.getConf('queryAssembly') as string
      return [target, query]
    }
    return assemblyNames
  }

  async getRefNames(opts: BaseOptions = {}) {
    // @ts-expect-error
    const r1 = opts.regions?.[0].assemblyName
    const records = await this.setup(opts)

    const idx = this.getAssemblyNames().indexOf(r1)
    if (idx !== -1) {
      const set = new Set<string>()
      for (const record of records) {
        set.add(idx === 0 ? record.refName : record.queryName)
      }
      return [...set]
    }
    console.warn('Unable to do ref renaming on adapter')
    return []
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const records = await this.setup(opts)
      const assemblyNames = this.getAssemblyNames()

      const { start: qstart, end: qend, refName: qref, assemblyName } = query
      const index = assemblyNames.indexOf(assemblyName)

      if (index === -1) {
        console.warn(`${assemblyName} not found in this adapter`)
        observer.complete()
        return
      }

      // If querying by target assembly (index 0), use refName/refStart/refEnd
      // If querying by query assembly (index 1), use queryName/queryStart/queryEnd
      const flip = index === 1

      for (let i = 0; i < records.length; i++) {
        const r = records[i]!

        let start: number
        let end: number
        let refName: string
        let mateName: string
        let mateStart: number
        let mateEnd: number

        if (flip) {
          // Query assembly perspective
          start = r.queryStart
          end = r.queryEnd
          refName = r.queryName
          mateName = r.refName
          mateStart = r.refStart
          mateEnd = r.refEnd
        } else {
          // Reference/target assembly perspective
          start = r.refStart
          end = r.refEnd
          refName = r.refName
          mateName = r.queryName
          mateStart = r.queryStart
          mateEnd = r.queryEnd
        }

        if (refName === qref && doesIntersect2(qstart, qend, start, end)) {
          observer.next(
            new SyntenyFeature({
              uniqueId: `${r.uniqueId}-${assemblyName}`,
              assemblyName,
              start,
              end,
              type: 'match',
              refName,
              strand: r.strand,
              syntenyId: i,
              syriType: r.syriType,
              annotationType: r.annotationType,
              parentId: r.parentId,
              copyStatus: r.copyStatus !== '-' ? r.copyStatus : undefined,
              mate: {
                start: mateStart,
                end: mateEnd,
                refName: mateName,
                assemblyName: assemblyNames[flip ? 0 : 1],
              },
            }),
          )
        }
      }

      observer.complete()
    })
  }
}

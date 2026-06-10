import { readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import type { SPARQLAdapterConfig } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

interface SPARQLEntry {
  type: string
  value: string
  dataTypes?: string
}

type SPARQLBinding = Record<string, SPARQLEntry>

// fill `{name}` placeholders from data; `{{name}}` is an escaped literal.
// replaces the `string-template` dependency
const templateRegex = /\{([0-9a-zA-Z_]+)\}/g
function fillTemplate(template: string, data: Record<string, string | number>) {
  return template.replace(templateRegex, (match, key: string, index: number) =>
    template[index - 1] === '{' && template[index + match.length] === '}'
      ? key
      : `${data[key] ?? ''}`,
  )
}

interface SPARQLResponseHead {
  vars: string[]
}

interface SPARQLResponseResults {
  bindings?: SPARQLBinding[]
}

interface SPARQLResponse {
  head: SPARQLResponseHead
  results: SPARQLResponseResults
}

interface SPARQLFeatureData {
  start: number
  end: number
  strand: number
  refName: string
  subfeatures?: SPARQLFeatureData[]
  uniqueId: string

  // SPARQL queries can return arbitrary extra columns, which are copied onto
  // the feature and surfaced in feature details
  [propName: string]: unknown
}

export default class SPARQLAdapter extends BaseFeatureDataAdapter {
  private endpoint: string

  private queryTemplate: string

  private refNamesQueryTemplate: string

  private additionalQueryParams: string[]

  private configRefNames: string[]

  private refNames: string[] | undefined

  public constructor(
    config: SPARQLAdapterConfig,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    this.endpoint = readConfObject(config, 'endpoint').uri
    this.queryTemplate = readConfObject(config, 'queryTemplate')
    this.additionalQueryParams = readConfObject(config, 'additionalQueryParams')
    this.refNamesQueryTemplate = readConfObject(config, 'refNamesQueryTemplate')
    this.configRefNames = readConfObject(config, 'refNames')
  }

  public async getRefNames(opts?: BaseOptions): Promise<string[]> {
    if (this.refNames) {
      return this.refNames
    }
    if (this.refNamesQueryTemplate) {
      const queryTemplate = encodeURIComponent(this.refNamesQueryTemplate)
      const results = await this.querySparql(queryTemplate, opts)
      this.refNames = this.resultsToRefNames(results)
    } else {
      this.refNames = this.configRefNames
    }
    return this.refNames
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { refName, start, end } = query
      const filledTemplate = encodeURIComponent(
        fillTemplate(this.queryTemplate, { refName, start, end }),
      )
      const results = await this.querySparql(filledTemplate, opts)
      const features = this.resultsToFeatures(results, refName)
      for (const feature of features) {
        observer.next(feature)
      }
      observer.complete()
    }, opts.stopToken)
  }

  private async querySparql(
    query: string,
    _opts?: BaseOptions,
  ): Promise<SPARQLResponse> {
    let additionalQueryParams = ''
    if (this.additionalQueryParams.length) {
      additionalQueryParams = `&${this.additionalQueryParams.join('&')}`
    }
    // TODO:ABORT
    const url = `${this.endpoint}?query=${query}${additionalQueryParams}`
    const response = await fetch(url, {
      headers: {
        accept: 'application/json,application/sparql-results+json',
      },
    })
    return response.json() as Promise<SPARQLResponse>
  }

  private resultsToRefNames(response: SPARQLResponse): string[] {
    const rows = response.results.bindings ?? []
    const fields = response.head.vars
    if (!fields.includes('refName')) {
      throw new Error('"refName" not found in refNamesQueryTemplate response')
    }
    return rows.map(row => row.refName!.value)
  }

  private resultsToFeatures(
    results: SPARQLResponse,
    refName: string,
  ): SimpleFeature[] {
    const rows = results.results.bindings ?? []
    const fields = results.head.vars
    const requiredFields = ['start', 'end', 'uniqueId']
    for (const requiredField of requiredFields) {
      if (!fields.includes(requiredField)) {
        console.error(
          `Required field ${requiredField} missing from feature data`,
        )
      }
    }

    // Each row encodes a feature plus its sub_/sub_sub_ ancestors. Flatten
    // every level into a single uniqueId->feature map and record each level's
    // parent, then attach children to parents in a second pass. Building the
    // full map first makes attachment independent of row/level ordering.
    const featuresById = new Map<string, SPARQLFeatureData>()
    const parentById = new Map<string, string>()
    for (const row of rows) {
      const levels: Record<string, string>[] = [{}]
      for (const field of fields) {
        if (field in row) {
          let name = field
          let depth = 0
          while (name.startsWith('sub_')) {
            name = name.slice(4)
            depth += 1
          }
          while (depth > levels.length - 1) {
            levels.push({})
          }
          levels[depth]![name] = row[field]!.value
        }
      }

      for (const [depth, level] of levels.entries()) {
        const { uniqueId, start, end, strand } = level
        featuresById.set(uniqueId!, {
          ...level,
          uniqueId: uniqueId!,
          refName,
          start: Number.parseInt(start!, 10),
          end: Number.parseInt(end!, 10),
          strand: Number.parseInt(strand!, 10) || 0,
        })
        if (depth > 0) {
          parentById.set(uniqueId!, levels[depth - 1]!.uniqueId!)
        }
      }
    }

    const roots: SPARQLFeatureData[] = []
    for (const [uniqueId, feature] of featuresById) {
      const pid = parentById.get(uniqueId)
      const parent = pid ? featuresById.get(pid) : undefined
      if (parent) {
        parent.subfeatures ??= []
        parent.subfeatures.push(feature)
      } else {
        if (pid) {
          console.error(`Could not find parentID ${pid}`)
        }
        roots.push(feature)
      }
    }

    return roots.map(data => new SimpleFeature(data))
  }

  public async hasDataForRefName(
    refName: string,
    opts: BaseOptions = {},
  ): Promise<boolean> {
    const refNames = await this.getRefNames(opts)
    if (refNames.length && !refNames.includes(refName)) {
      return false
    }
    return true
  }
}

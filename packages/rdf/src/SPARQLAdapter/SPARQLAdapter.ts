import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation, INoAssemblyRegion } from '@gmod/jbrowse-core/mst-types'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { Observable, Observer } from 'rxjs'
import format from 'string-template'

interface SPARQLEntry {
  type: string
  value: string
  dataTypes?: string
}

interface SPARQLBinding {
  [key: string]: SPARQLEntry
}

interface SPARQLResponseHead {
  vars: string[]
}

interface SPARQLResponseResults {
  bindings: SPARQLBinding[]
}

interface SPARQLResponse {
  head: SPARQLResponseHead
  results: SPARQLResponseResults
}

interface SPARQLFeatureData {
  start: number
  end: number
  strand: number
  subfeatures?: SPARQLFeatureData[]
  uniqueId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [propName: string]: any
}

interface SPARQLFeature {
  data: SPARQLFeatureData
}

export default class extends BaseAdapter {
  private endpoint: string

  private queryTemplate: string

  private refNamesQueryTemplate: string

  private additionalQueryParams: string[]

  private refNames: string[] | undefined

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: {
    endpoint: IFileLocation
    queryTemplate: string
    refNamesQueryTemplate: string
    additionalQueryParams: string[]
  }) {
    super()
    const {
      endpoint,
      queryTemplate,
      refNamesQueryTemplate,
      additionalQueryParams,
    } = config

    // @ts-ignore
    this.endpoint = endpoint.uri
    this.queryTemplate = queryTemplate
    this.additionalQueryParams = additionalQueryParams
    this.refNamesQueryTemplate = refNamesQueryTemplate
  }

  public async getRefNames(opts: BaseOptions = {}): Promise<string[]> {
    if (this.refNames) return this.refNames
    let refNames = [] as string[]
    if (this.refNamesQueryTemplate) {
      const queryTemplate = encodeURIComponent(this.refNamesQueryTemplate)
      const results = await this.querySparql(queryTemplate, opts)
      refNames = this.resultsToRefNames(results)
    }
    this.refNames = refNames
    return refNames
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures(
    query: INoAssemblyRegion,
    opts: BaseOptions = {},
  ): Observable<Feature> {
    return ObservableCreate<Feature>(
      async (observer: Observer<Feature>): Promise<void> => {
        const filledTemplate = encodeURIComponent(
          format(this.queryTemplate, query),
        )
        const { refName } = query
        const results = await this.querySparql(filledTemplate, opts)
        this.resultsToFeatures(results, refName).forEach(feature => {
          observer.next(feature)
        })
        observer.complete()
      },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async querySparql(query: string, opts?: BaseOptions): Promise<any> {
    let additionalQueryParams = ''
    if (this.additionalQueryParams.length)
      additionalQueryParams = `&${this.additionalQueryParams.join('&')}`
    const signal = opts && opts.signal
    const response = await fetch(
      `${this.endpoint}?query=${query}${additionalQueryParams}`,
      {
        headers: { accept: 'application/json,application/sparql-results+json' },
        signal,
      },
    )
    return response.json()
  }

  private resultsToRefNames(response: SPARQLResponse): string[] {
    const rows = ((response || {}).results || {}).bindings || []
    if (!rows.length) return []
    const fields = response.head.vars
    if (!fields.includes('refName'))
      throw new Error('"refName" not found in refNamesQueryTemplate response')
    return rows.map(row => row.refName.value)
  }

  private resultsToFeatures(
    results: SPARQLResponse,
    refName: string,
  ): SimpleFeature[] {
    const rows = ((results || {}).results || {}).bindings || []
    if (!rows.length) return []
    const fields = results.head.vars
    const requiredFields = ['start', 'end', 'uniqueId']
    requiredFields.forEach(requiredField => {
      if (!fields.includes(requiredField))
        console.error(
          `Required field ${requiredField} missing from feature data`,
        )
    })
    const seenFeatures: Record<string, SPARQLFeature> = {}
    rows.forEach(row => {
      const rawData: Record<string, string>[] = [{}]
      fields.forEach(field => {
        if (field in row) {
          const { value } = row[field]
          let idx = 0
          while (field.startsWith('sub_')) {
            field = field.slice(4)
            idx += 1
          }
          while (idx > rawData.length - 1) rawData.push({})
          rawData[idx][field] = value
        }
      })

      rawData.forEach((rd, idx) => {
        const { uniqueId } = rd
        if (idx < rawData.length - 1) rawData[idx + 1].parentUniqueId = uniqueId
        seenFeatures[uniqueId] = {
          data: {
            ...rd,
            uniqueId,
            refName,
            start: parseInt(rd.start, 10),
            end: parseInt(rd.end, 10),
            strand: parseInt(rd.strand, 10) || 0,
          },
        }
      })
    })

    // resolve subfeatures, keeping only top-level features in seenFeatures
    for (const [uniqueId, f] of Object.entries(seenFeatures)) {
      const pid = f.data.parentUniqueId
      delete f.data.parentUniqueId
      if (pid) {
        const p = seenFeatures[pid]
        if (p) {
          if (!p.data.subfeatures) p.data.subfeatures = []
          p.data.subfeatures.push({
            ...f.data,
            uniqueId,
          })
          delete seenFeatures[uniqueId]
        } else {
          const subfeatures = Object.values(seenFeatures)
            .map(sf => sf.data.subfeatures)
            .filter(sf => !!sf)
            .flat()
          let found = false
          for (const subfeature of subfeatures) {
            if (subfeature.uniqueId === pid) {
              if (!subfeature.subfeatures) subfeature.subfeatures = []
              subfeature.subfeatures.push({
                ...f.data,
                uniqueId,
              })
              delete seenFeatures[uniqueId]
              found = true
              break
            } else if (subfeature.subfeatures)
              subfeatures.push(subfeature.subfeatures)
          }
          if (!found) console.error(`Could not find parentID ${pid}`)
        }
      }
    }

    return Object.keys(seenFeatures).map(
      seenFeature =>
        new SimpleFeature({
          data: {
            uniqeId: seenFeature,
            ...seenFeatures[seenFeature].data,
            subfeatures: seenFeatures[seenFeature].data.subfeatures,
          },
        }),
    )
  }

  public async hasDataForRefName(
    refName: string,
    opts: BaseOptions = {},
  ): Promise<boolean> {
    const refNames = await this.getRefNames(opts)
    if (refNames.length && !refNames.includes(refName)) return false
    return true
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */): void {}
}

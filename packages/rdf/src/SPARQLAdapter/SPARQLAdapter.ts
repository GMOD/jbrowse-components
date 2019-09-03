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
  [propName: string]: string | number
}

interface SPARQLFeature {
  data: SPARQLFeatureData
  subfeatures?: SPARQLFeature[]
}

export default class extends BaseAdapter {
  private endpoint: string

  private queryTemplate: string

  private additionalQueryParams: string[]

  public static capabilities = ['getFeatures']

  public constructor(config: {
    endpoint: IFileLocation
    queryTemplate: string
    additionalQueryParams: string[]
  }) {
    super()
    const { endpoint, queryTemplate, additionalQueryParams } = config

    // @ts-ignore
    this.endpoint = endpoint.uri
    this.queryTemplate = queryTemplate
    this.additionalQueryParams = additionalQueryParams
  }

  public async getRefNames(opts: BaseOptions = {}): Promise<string[]> {
    return []
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
        let additionalQueryParams = ''
        if (this.additionalQueryParams.length)
          additionalQueryParams = `&${this.additionalQueryParams.join('&')}`
        const response = await fetch(
          `${this.endpoint}?query=${filledTemplate}${additionalQueryParams}`,
          { headers: { accept: 'application/json' } },
        )
        const results = await response.json()
        this.resultsToFeatures(results, refName).forEach(feature => {
          observer.next(feature)
        })
        observer.complete()
      },
    )
  }

  private resultsToFeatures(
    results: SPARQLResponse,
    refName: string,
  ): SimpleFeature[] {
    const rows = ((results || {}).results || {}).bindings || []
    if (!rows.length) return []
    const fields = results.head.vars
    const requiredFields = ['start', 'end', 'strand', 'uniqueID']
    requiredFields.forEach(requiredField => {
      if (!fields.includes(requiredField))
        console.error(
          `Required field ${requiredField} missing from feature data`,
        )
    })
    const seenFeatures: Record<string, SPARQLFeature> = {}
    rows.forEach(row => {
      const rawData: Record<string, string> = {}
      fields.forEach(field => {
        if (field in row) rawData[field] = row[field].value
      })

      const id = rawData.uniqueID
      delete rawData.uniqueID
      seenFeatures[id] = {
        data: {
          ...rawData,
          refName,
          start: parseInt(rawData.start, 10),
          end: parseInt(rawData.end, 10),
          strand: parseInt(rawData.strand, 10),
        },
      }
    })

    // resolve subfeatures, keeping only top-level features in seenFeatures
    for (const id of Object.keys(seenFeatures)) {
      const f = seenFeatures[id]
      const pid = f.data.parentUniqueID
      delete f.data.parentUniqueID
      if (pid) {
        const p = seenFeatures[pid]
        if (p) {
          if (!p.subfeatures) p.subfeatures = []
          p.subfeatures.push(f)
          delete seenFeatures[id]
        }
      }
    }

    return Object.keys(seenFeatures).map(
      seenFeature =>
        new SimpleFeature({
          id: seenFeature,
          data: {
            ...seenFeatures[seenFeature].data,
            subfeatures: seenFeatures[seenFeature].subfeatures,
          },
        }),
    )
  }

  public async hasDataForRefName(): Promise<boolean> {
    return true
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */): void {}
}

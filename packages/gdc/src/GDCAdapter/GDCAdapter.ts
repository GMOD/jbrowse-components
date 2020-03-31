/* eslint-disable @typescript-eslint/no-explicit-any */
import BaseAdapter from '@gmod/jbrowse-core/BaseAdapter'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { Observable, Observer } from 'rxjs'
import GDCFeature from './GDCFeature'

export default class extends BaseAdapter {
  protected parser: any

  private filters: string

  private cases: Array<string>

  private size: number

  private featureType: string

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: {
    filters: string
    cases: Array<string>
    size: number
    featureType: string
  }) {
    super()
    this.filters = config.filters ? config.filters : '{}'
    this.cases = config.cases ? config.cases : []
    this.size = config.size ? config.size : 100
    this.featureType = config.featureType ? config.featureType : 'mutation'
  }

  public async getRefNames() {
    return Promise.resolve([
      'chr1',
      'chr10',
      'chr11',
      'chr12',
      'chr13',
      'chr14',
      'chr15',
      'chr16',
      'chr17',
      'chr18',
      'chr19',
      'chr2',
      'chr20',
      'chr21',
      'chr22',
      'chr3',
      'chr4',
      'chr5',
      'chr6',
      'chr7',
      'chr8',
      'chr9',
      'chrX',
      'chrY',
    ])
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures(region: IRegion): Observable<Feature> {
    const { refName, start, end } = region
    return ObservableCreate(async (observer: Observer<Feature>) => {
      try {
        const parser = await this.parser
        let query = {}
        let idField = 'mutation'

        switch (this.featureType) {
          case 'mutation': {
            query = this.createMutationQuery(
              refName.replace(/chr/, ''),
              start,
              end,
            )
            idField = 'ssmId'
            break
          }
          case 'gene': {
            query = this.createGeneQuery(refName.replace(/chr/, ''), start, end)
            idField = 'geneId'
            break
          }
          default: {
            observer.error(`Not a valid type: ${this.featureType}`)
          }
        }
        const options = {
          method: 'POST',
          body: JSON.stringify(query),
        }
        const response = await fetch(
          'https://api.gdc.cancer.gov/v0/graphql',
          options,
        )
        const data = await response.json()
        const queryResults = data.data.viewer.explore.features.hits.edges
        const totalCaseCount = data.data.viewer.explore.cases
          ? data.data.viewer.explore.cases.hits.total
          : undefined
        const filteredCaseCount = data.data.viewer.explore.filteredCases
          ? data.data.viewer.explore.filteredCases.hits.total
          : undefined

        for (const hit of queryResults) {
          if (hit) {
            const gdcObject = hit.node
            if (filteredCaseCount) {
              gdcObject.totalCasesInCohort = filteredCaseCount
            }
            if (totalCaseCount) {
              gdcObject.totalCasesInGDC = totalCaseCount
            }
            const feature = new GDCFeature({
              gdcObject,
              parser,
              id: gdcObject[idField],
              featureType: this.featureType,
            }) as Feature
            observer.next(feature)
          }
        }
      } catch (e) {
        observer.error(e)
      }
      observer.complete()
    })
  }

  public freeResources(): void {}

  /**
   * Create a GraphQL query for GDC mutations
   * @param ref chromosome reference
   * @param start start position
   * @param end end position
   */
  private createMutationQuery(ref: string, start: number, end: number) {
    const ssmQuery = `query mutationsQuery( $size: Int $offset: Int $filters: FiltersArgument $ssmFilter: FiltersArgument $score: String $sort: [Sort] ) { viewer { explore { cases { hits(first: 0, filters: $ssmFilter) { total } } filteredCases: cases { hits(first: 0, filters: $filters) { total } } features: ssms { hits(first: $size, offset: $offset, filters: $filters, score: $score, sort: $sort) { total edges { node { score startPosition: start_position endPosition: end_position mutationType: mutation_type cosmicId: cosmic_id referenceAllele: reference_allele ncbiBuild: ncbi_build genomicDnaChange: genomic_dna_change mutationSubtype: mutation_subtype ssmId: ssm_id chromosome filteredOccurences: occurrence { hits(first: 0, filters: $filters) { numOfAffectedCasesInCohort: total } } occurrence { hits(first: 0, filters: $ssmFilter) { numOfAffectedCasesAcrossGDC: total } } } } } } } } }`
    const combinedFilters = this.getFilterQuery(ref, start, end)
    const body = {
      query: ssmQuery,
      variables: {
        size: this.size ? this.size : 1000,
        offset: 0,
        filters: combinedFilters,
        score: 'occurrence.case.project.project_id',
        sort: [
          { field: '_score', order: 'desc' },
          { field: '_uid', order: 'asc' },
        ],
        ssmFilter: {
          op: 'and',
          content: [
            {
              op: 'in',
              content: {
                field: 'cases.available_variation_data',
                value: ['ssm'],
              },
            },
          ],
        },
      },
    }
    return body
  }

  /**
   * Create a GraphQL query for GDC genes
   * @param ref chromosome reference
   * @param start start position
   * @param end end position
   */
  private createGeneQuery(ref: string, start: number, end: number) {
    const geneQuery = `query genesQuery( $filters: FiltersArgument $size: Int $offset: Int $score: String ) { viewer { explore { features: genes { hits(first: $size, offset: $offset, filters: $filters, score: $score) { total edges { node { geneId: gene_id id geneStrand: gene_strand synonyms symbol name geneStart: gene_start geneEnd: gene_end geneChromosome: gene_chromosome description canonicalTranscriptId: canonical_transcript_id externalDbIds: external_db_ids { hgnc omimGene: omim_gene uniprotkbSwissprot: uniprotkb_swissprot entrezGene: entrez_gene } biotype isCancerGeneCensus: is_cancer_gene_census } } } } } } }`
    const combinedFilters = this.getFilterQuery(ref, start, end)
    const body = {
      query: geneQuery,
      variables: {
        filters: combinedFilters,
        size: this.size ? this.size : 1000,
        offset: 0,
        score: 'case.project.project_id',
      },
    }
    return body
  }

  /**
   * Create the full filter based on the given filter and the location
   * @param chr chromosome (ex. 1)
   * @param start start position
   * @param end end position
   */
  private getFilterQuery(chr: string, start: number, end: number) {
    const resultingFilterQuery = {
      op: 'and',
      content: [this.getLocationFilters(chr, start, end)],
    }

    const filterObject = JSON.parse(this.filters)

    if (filterObject && Object.keys(filterObject).length > 0) {
      resultingFilterQuery.content.push(filterObject)
    }

    return resultingFilterQuery
  }

  /**
   * Create a filter for the current location visible
   * @param chr chromosome (ex. 1)
   * @param start start position
   * @param end end position
   */
  private getLocationFilters(chr: string, start: number, end: number) {
    let locationFilter: any

    switch (this.featureType) {
      case 'mutation': {
        locationFilter = {
          op: 'and',
          content: [
            {
              op: '>=',
              content: { field: 'ssms.start_position', value: start },
            },
            { op: '<=', content: { field: 'ssms.end_position', value: end } },
            {
              op: '=',
              content: { field: 'ssms.chromosome', value: [`chr${chr}`] },
            },
          ],
        }
        break
      }
      case 'gene': {
        locationFilter = {
          op: 'and',
          content: [
            { op: '>=', content: { field: 'genes.gene_start', value: start } },
            { op: '<=', content: { field: 'genes.gene_end', value: end } },
            {
              op: '=',
              content: { field: 'genes.gene_chromosome', value: [chr] },
            },
          ],
        }
        break
      }
    }

    if (this.cases && this.cases.length > 0) {
      const caseFilter = {
        op: 'in',
        content: { field: 'cases.case_id', value: this.cases },
      }
      locationFilter.content.push(caseFilter)
    }
    return locationFilter
  }
}

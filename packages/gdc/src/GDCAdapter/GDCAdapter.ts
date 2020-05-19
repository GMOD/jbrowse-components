/* eslint-disable @typescript-eslint/no-explicit-any */
import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import GDCFeature from './GDCFeature'

export default class extends BaseAdapter {
  private filters: string

  private cases: string[]

  private size: number

  private featureType: string

  private colourBy: string

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: {
    filters?: string
    cases?: string[]
    size?: number
    featureType?: string
    colourBy?: string
  }) {
    super(config)
    const {
      filters = '{}',
      cases = [],
      size = 100,
      featureType = 'mutation',
      colourBy = '{}',
    } = config
    this.filters = filters
    this.cases = cases
    this.size = size
    this.featureType = featureType
    this.colourBy = colourBy
  }

  public async getRefNames(opts?: BaseOptions) {
    return [
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
    ]
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures(region: IRegion) {
    const { refName, start, end } = region
    return ObservableCreate<Feature>(async observer => {
      try {
        let query = {}
        let idField = 'ssmId'

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
        const response = await fetch('https://api.gdc.cancer.gov/v0/graphql', {
          method: 'POST',
          body: JSON.stringify(query),
        })
        const result = await response.json()
        const queryResults = result.data.viewer.explore.features.hits.edges
        const cohortCount = result.data.viewer.explore.filteredCases.hits.total

        for (const hit of queryResults) {
          const gdcObject = hit.node
          gdcObject.numOfCasesInCohort = cohortCount
          const feature = new GDCFeature({
            gdcObject,
            id: gdcObject[idField],
            featureType: this.featureType,
          })
          observer.next(feature)
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
    const ssmQuery = `query mutationsQuery( $size: Int $offset: Int $filters: FiltersArgument $filtersWithoutLocation: FiltersArgument $score: String $sort: [Sort] ) { viewer { explore { filteredCases: cases { hits(first: 0, filters: $filtersWithoutLocation) { total } } features: ssms { hits(first: $size, offset: $offset, filters: $filters, score: $score, sort: $sort) { total edges { node { numOfOccurrencesInCohort: score startPosition: start_position endPosition: end_position mutationType: mutation_type cosmicId: cosmic_id referenceAllele: reference_allele ncbiBuild: ncbi_build genomicDnaChange: genomic_dna_change mutationSubtype: mutation_subtype ssmId: ssm_id chromosome consequence { hits { edges { node { transcript { is_canonical annotation { vep_impact polyphen_impact polyphen_score sift_score sift_impact hgvsc } consequence_type gene { gene_id symbol gene_strand } aa_change transcript_id } id } } } } } } } } } } }`
    const combinedFilters = this.getFilterQuery(ref, start, end, false)
    const filtersNoLocation = this.getFilterQuery(ref, start, end, true)
    const body = {
      query: ssmQuery,
      variables: {
        size: this.size ? this.size : 5000,
        offset: 0,
        filters: combinedFilters,
        filtersWithoutLocation: filtersNoLocation,
        score: 'occurrence.case.project.project_id',
        sort: [
          { field: '_score', order: 'desc' },
          { field: '_uid', order: 'asc' },
        ],
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
    const combinedFilters = this.getFilterQuery(ref, start, end, false)
    const body = {
      query: geneQuery,
      variables: {
        filters: combinedFilters,
        size: this.size ? this.size : 5000,
        offset: 0,
        score: 'case.project.project_id',
      },
    }
    return body
  }

  /**
   * Create the full filter based on the given filter, location and case(s)
   * @param chr chromosome (ex. 1)
   * @param start start position
   * @param end end position
   */
  private getFilterQuery(
    chr: string,
    start: number,
    end: number,
    skipLocation: boolean,
  ) {
    const resultingFilterQuery = {
      op: 'and',
      content: [
        this.addLocationAndCasesToFilter(chr, start, end, skipLocation),
      ],
    }

    const filterObject = JSON.parse(this.filters)

    if (filterObject && Object.keys(filterObject).length > 0) {
      resultingFilterQuery.content.push(filterObject)
    }

    return resultingFilterQuery
  }

  /**
   * Create a filter for the current visible location and case(s)
   * @param chr chromosome (ex. 1)
   * @param start start position
   * @param end end position
   */
  private addLocationAndCasesToFilter(
    chr: string,
    start: number,
    end: number,
    skipLocation: boolean,
  ) {
    let locationFilter: any

    if (!skipLocation) {
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
              {
                op: '>=',
                content: { field: 'genes.gene_start', value: start },
              },
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
    } else {
      locationFilter = {
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'available_variation_data',
              value: ['ssm'],
            },
          },
        ],
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

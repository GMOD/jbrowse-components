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

  private case: string

  private size: number

  private featureType: string

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: {
    filters: string
    case: string
    size: number
    featureType: string
  }) {
    super()
    this.filters = config.filters ? config.filters : '{}'
    this.case = config.case ? config.case : ''
    this.size = config.size ? config.size : 100
    this.featureType = config.featureType ? config.featureType : 'ssm'
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
        let idField = 'ssm'

        switch (this.featureType) {
          case 'ssm': {
            query = this.createSSMQuery(refName.replace(/chr/, ''), start, end)
            idField = 'ssm_id'
            break
          }
          case 'gene': {
            query = this.createGeneQuery(refName.replace(/chr/, ''), start, end)
            idField = 'gene_id'
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
        for (const hit of queryResults) {
          if (hit) {
            const gdcObject = hit.node
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
  private createSSMQuery(ref: string, start: number, end: number) {
    const ssmQuery = `query mutationsQuery( $size: Int $offset: Int $filters: FiltersArgument $score: String $sort: [Sort] ) { viewer { explore { features: ssms { hits(first: $size, offset: $offset, filters: $filters, score: $score, sort: $sort) { total edges { node { start_position end_position mutation_type cosmic_id reference_allele ncbi_build score genomic_dna_change mutation_subtype ssm_id chromosome } } } } } } }`
    // const ssmQuery = `query mutationsQuery( $size: Int $offset: Int $filters: FiltersArgument $score: String $sort: [Sort] ) { viewer { explore { ssms { hits(first: $size, offset: $offset, filters: $filters, score: $score, sort: $sort) { total edges { node { start_position end_position mutation_type cosmic_id reference_allele ncbi_build score genomic_dna_change mutation_subtype ssm_id chromosome consequence { hits { edges { node { transcript { is_canonical annotation { vep_impact polyphen_impact polyphen_score sift_score sift_impact hgvsc } consequence_type gene { gene_id symbol gene_strand } aa_change transcript_id } id } } } } } } } } } } }`
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
    const geneQuery = `query genesQuery( $filters: FiltersArgument $size: Int $offset: Int $score: String ) { viewer { explore { features: genes { hits(first: $size, offset: $offset, filters: $filters, score: $score) { total edges { node { gene_id id gene_strand synonyms symbol name gene_start gene_end gene_chromosome description canonical_transcript_id external_db_ids { hgnc omim_gene uniprotkb_swissprot entrez_gene } biotype numCases: score is_cancer_gene_census } } } } } } }`
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
    const locationFilter: any = {
      op: 'and',
      content: [
        { op: '>=', content: { field: 'ssms.start_position', value: start } },
        { op: '<=', content: { field: 'ssms.end_position', value: end } },
        {
          op: '=',
          content: { field: 'ssms.chromosome', value: [`chr${chr}`] },
        },
      ],
    }

    if (this.case) {
      const caseFilter = {
        op: 'in',
        content: { field: 'cases.case_id', value: this.case },
      }
      locationFilter.content.push(caseFilter)
    }
    return locationFilter
  }
}

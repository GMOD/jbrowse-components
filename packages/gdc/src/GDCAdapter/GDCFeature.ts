import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

interface FeatureData {
  [key: string]: unknown
  refName: string
  start: number
  end: number
  type: string
}

export default class GDCFeature implements Feature {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private gdcObject: any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parser: any

  private data: FeatureData

  private uniqueId: string

  private featureType: string

  private GDC_LINK = 'https://portal.gdc.cancer.gov/'

  private ENSEMBL_LINK = 'http://www.ensembl.org/id/'

  private COSMIC_LINK =
    'https://cancer.sanger.ac.uk/cosmic/mutation/overview?id='

  private NCBI_LINK = 'http://www.ncbi.nlm.nih.gov/gene/'

  private UNI_LINK = 'http://www.uniprot.org/uniprot/'

  private HGNC_LINK =
    'https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/'

  private OMIM_LINK = 'https://www.omim.org/entry/'

  constructor(args: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gdcObject: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parser: any
    id: string
    featureType: string
  }) {
    this.gdcObject = args.gdcObject
    this.parser = args.parser
    this.featureType = args.featureType ? args.featureType : 'mutation'
    this.createLinksToRemoteSites()
    this.data = this.dataFromGDCObject(this.gdcObject, this.featureType)
    this.uniqueId = args.id
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(field: string): any {
    return this.gdcObject[field] || this.data[field]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(name: string, val: any): void {}

  parent(): undefined {
    return undefined
  }

  children(): undefined {
    return undefined
  }

  tags(): string[] {
    const t = [...Object.keys(this.data), ...Object.keys(this.gdcObject)]
    return t
  }

  id(): string {
    return this.uniqueId
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataFromGDCObject(gdcObject: any, featureType: string): FeatureData {
    // Defaults to mutation values
    const featureData: FeatureData = {
      refName: gdcObject.chromosome,
      type: gdcObject.mutationType,
      start: gdcObject.startPosition - 1,
      end: gdcObject.endPosition,
    }

    switch (featureType) {
      case 'gene': {
        featureData.start = gdcObject.geneStart - 1
        featureData.end = gdcObject.geneEnd
        featureData.refName = gdcObject.geneChromosome
        featureData.type = gdcObject.biotype
        break
      }
    }

    return featureData
  }

  /**
   * Converts and id string to a link
   * @param id element id
   * @param name element name (to display)
   * @param url URL to element on site
   */
  convertStringToLink(id: string, name: string, url: string): string {
    if (!id || !name || id.length === 0 || name.length === 0) {
      return 'n/a'
    }
    return `<a href="${url}${id}" target="_blank">${name}</a>`
  }

  /**
   * Converts an array of cosmic ids to links
   * @param cosmic array of cosmic ids
   */
  convertCosmicIdsToLinks(cosmic: string[]): string {
    if (cosmic) {
      const cosmicLinks: string[] = []
      for (const cosmicId of cosmic) {
        let cosmicIdNoPrefix = cosmicId.replace('COSM', '')
        cosmicIdNoPrefix = cosmicIdNoPrefix.replace('COSN', '')
        cosmicLinks.push(
          this.convertStringToLink(
            cosmicIdNoPrefix,
            cosmicIdNoPrefix,
            this.COSMIC_LINK,
          ),
        )
      }

      if (cosmicLinks.length > 0) {
        return cosmicLinks.join(', ')
      }
    }
    return 'n/a'
  }

  /**
   * Converts some of the feature attributes to links and updates the gdcObject
   */
  createLinksToRemoteSites(): void {
    if (this.featureType === 'mutation') {
      this.gdcObject.ssmId = this.convertStringToLink(
        this.gdcObject.ssmId,
        this.gdcObject.ssmId,
        `${this.GDC_LINK}ssms/`,
      )
      this.gdcObject.cosmicId = this.convertCosmicIdsToLinks(
        this.gdcObject.cosmicId,
      )
    } else if (this.featureType === 'gene') {
      this.gdcObject.gdc = this.convertStringToLink(
        this.gdcObject.geneId,
        this.gdcObject.geneId,
        `${this.GDC_LINK}genes/`,
      )
      this.gdcObject.ensembl = this.convertStringToLink(
        this.gdcObject.geneId,
        this.gdcObject.geneId,
        this.ENSEMBL_LINK,
      )
      this.gdcObject.canonicalTranscriptId = this.convertStringToLink(
        this.gdcObject.canonicalTranscriptId,
        this.gdcObject.canonicalTranscriptId,
        this.ENSEMBL_LINK,
      )

      this.gdcObject.hgnc = this.convertStringToLink(
        this.gdcObject.externalDbIds.hgnc,
        this.gdcObject.externalDbIds.hgnc,
        this.HGNC_LINK,
      )

      this.gdcObject.hgnc = this.convertStringToLink(
        this.gdcObject.externalDbIds.hgnc,
        this.gdcObject.externalDbIds.hgnc,
        this.HGNC_LINK,
      )

      this.gdcObject.uniprotkbSwissprot = this.convertStringToLink(
        this.gdcObject.externalDbIds.uniprotkbSwissprot,
        this.gdcObject.externalDbIds.uniprotkbSwissprot,
        this.UNI_LINK,
      )

      this.gdcObject.ncbiGene = this.convertStringToLink(
        this.gdcObject.externalDbIds.entrezGene,
        this.gdcObject.externalDbIds.entrezGene,
        this.NCBI_LINK,
      )

      this.gdcObject.omimGene = this.convertStringToLink(
        this.gdcObject.externalDbIds.omimGene,
        this.gdcObject.externalDbIds.omimGene,
        this.OMIM_LINK,
      )

      // Clear some elements that have been converted
      this.gdcObject.geneId = undefined
      this.gdcObject.externalDbIds.uniprotkbSwissprot = undefined
      this.gdcObject.externalDbIds.hgnc = undefined
      this.gdcObject.externalDbIds.entrezGene = undefined
      this.gdcObject.externalDbIds.omimGene = undefined
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return {
      uniqueId: this.uniqueId,
      ...this.data,
      ...this.gdcObject,
    }
  }
}

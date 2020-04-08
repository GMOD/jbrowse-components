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
    id: string
    featureType: string
  }) {
    this.gdcObject = args.gdcObject
    this.featureType = args.featureType ? args.featureType : 'mutation'
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return {
      uniqueId: this.uniqueId,
      ...this.data,
      ...this.gdcObject,
    }
  }
}

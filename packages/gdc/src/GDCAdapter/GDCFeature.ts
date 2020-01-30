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

  private _id: string

  private featureType: string

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
    this.featureType = args.featureType ? args.featureType : 'ssm'
    this.data = this.dataFromGDCObject(this.gdcObject, this.featureType)
    this._id = args.id
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
    return this._id
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataFromGDCObject(gdcObject: any, featureType: string): FeatureData {
    // Defaults to SSM values
    const featureData: FeatureData = {
      refName: gdcObject.chromosome,
      type: gdcObject.mutation_type,
      start: gdcObject.start_position,
      end: gdcObject.end_position,
    }

    switch (featureType) {
      case 'gene': {
        featureData.start = gdcObject.gene_start
        featureData.end = gdcObject.gene_end
        featureData.refName = gdcObject.gene_chromosome
        featureData.type = gdcObject.biotype
        break
      }
    }

    return featureData
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return {
      uniqueId: this._id,
      ...this.data,
      ...this.gdcObject,
    }
  }
}

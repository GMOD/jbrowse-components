import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

/* eslint-disable no-underscore-dangle, @typescript-eslint/camelcase */

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(args: { gdcObject: any; parser: any; id: string }) {
    this.gdcObject = args.gdcObject
    this.parser = args.parser
    this.data = this.dataFromGDCObject(this.gdcObject)
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
  dataFromGDCObject(gdcObject: any): FeatureData {
    const featureData: FeatureData = {
      refName: gdcObject.chromosome,
      start: gdcObject.start_position,
      end: gdcObject.end_position,
      type: gdcObject.type,
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

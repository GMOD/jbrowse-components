/* eslint-disable @typescript-eslint/camelcase */
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

const jb2ToJb1 = { refName: 'seq_id' }

const jb1ToJb2 = { seq_id: 'refName' }

/**
 * wrapper to adapt nclist features to act like jbrowse 2 features
 */
export default class NCListFeature implements Feature {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ncFeature: any

  private parentHandle?: Feature

  private uniqueId: string

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(ncFeature: any, parent?: Feature) {
    this.ncFeature = ncFeature
    this.uniqueId = ncFeature.id()
    this.parentHandle = parent
  }

  set(): void {
    throw new Error('not implemented')
  }

  jb2TagToJb1Tag(tag: string): string {
    // @ts-ignore
    const mapped = jb2ToJb1[tag] || tag
    return mapped.toLowerCase()
  }

  jb1TagToJb2Tag(tag: string): string {
    const t = tag.toLowerCase()
    // @ts-ignore
    const mapped = jb1ToJb2[t] || t
    return mapped
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(attrName: string): any {
    const attr = this.ncFeature.get(this.jb2TagToJb1Tag(attrName))
    if (attr && attrName === 'subfeatures')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return attr.map((subfeature: any) => new NCListFeature(subfeature))
    return attr
  }

  /**
   * Get an array listing which data keys are present in this feature.
   */
  tags(): string[] {
    return this.ncFeature.tags().map((t: string) => this.jb1TagToJb2Tag(t))
  }

  /**
   * Get the unique ID of this feature.
   */
  id(): string {
    return this.uniqueId
  }

  /**
   * Get this feature's parent feature, or undefined if none.
   */
  parent(): Feature | undefined {
    return this.parentHandle
  }

  /**
   * Get an array of child features, or undefined if none.
   */
  children(): Feature[] | undefined {
    return this.get('subfeatures')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = { uniqueId: this.id() }
    this.ncFeature.tags().forEach((tag: string) => {
      const mappedTag = this.jb1TagToJb2Tag(tag)
      const value = this.ncFeature.get(tag)
      if (mappedTag === 'subfeatures') {
        data.subfeatures = (value || []).map((f: Feature, i: number) => {
          // note: was new NCListFeature(f, `${this.id()}-${i}`, this).toJSON()
          return new NCListFeature(f, this).toJSON()
        })
      } else {
        data[mappedTag] = value
      }
    })
    return data
  }
}

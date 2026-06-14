import type {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'

const jb2ToJb1: Record<string, string | undefined> = { refName: 'seq_id' }

const jb1ToJb2: Record<string, string | undefined> = { seq_id: 'refName' }

/**
 * the duck-typed shape of a raw @gmod/nclist feature (which the library types
 * only as `any`)
 */
export interface NCListRawFeature {
  id(): string
  get(attr: string): unknown
  tags(): string[]
}

/**
 * wrapper to adapt nclist features to act like jbrowse 2 features
 */
export default class NCListFeature implements Feature {
  private parentHandle?: Feature
  private uniqueId: string
  private ncFeature: NCListRawFeature

  constructor(ncFeature: NCListRawFeature, parent?: Feature, id?: string) {
    this.ncFeature = ncFeature
    this.uniqueId = id || ncFeature.id()
    this.parentHandle = parent
  }

  set(): void {
    throw new Error('not implemented')
  }

  jb2TagToJb1Tag(tag: string): string {
    return (jb2ToJb1[tag] ?? tag).toLowerCase()
  }

  jb1TagToJb2Tag(tag: string): string {
    const t = tag.toLowerCase()
    return jb1ToJb2[t] ?? t
  }

  get(name: 'refName'): string
  get(name: 'name' | 'type' | 'id' | 'source'): string | undefined
  get(name: 'start' | 'end'): number
  get(name: 'phase'): 0 | 1 | 2 | undefined
  get(name: 'strand'): -1 | 0 | 1 | undefined
  get(name: 'score'): number | undefined
  get(name: 'subfeatures'): Feature[] | undefined
  get(name: string): unknown
  get(attrName: string): unknown {
    const attr = this.ncFeature.get(this.jb2TagToJb1Tag(attrName))
    if (attr && attrName === 'subfeatures') {
      return (attr as NCListRawFeature[]).map(
        subfeature => new NCListFeature(subfeature, this),
      )
    }
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

  toJSON(): SimpleFeatureSerialized {
    const data: Record<string, unknown> = { uniqueId: this.id() }

    for (const tag of this.ncFeature.tags()) {
      const mappedTag = this.jb1TagToJb2Tag(tag)
      const value = this.ncFeature.get(tag)
      if (mappedTag === 'subfeatures') {
        data.subfeatures = (
          (value as NCListRawFeature[] | undefined) ?? []
        ).map(
          // note: was new NCListFeature(f, `${this.id()}-${i}`, this).toJSON()
          f => new NCListFeature(f, this).toJSON(),
        )
      } else {
        data[mappedTag] = value
      }
    }
    return data as SimpleFeatureSerialized
  }
}

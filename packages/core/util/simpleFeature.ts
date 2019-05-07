/**
 * Abstract feature object
 */
export interface Feature {
  /**
   * Get a piece of data about the feature.  All features must have
   * 'start' and 'end', but everything else is optional.
   */
  // @ts-ignore unspecified types can be returned from Feature
  get(name: string): any

  /**
   * Set an item of data.
   */
  // @ts-ignore unspecified types can be set on Feature
  set(name: string, val: any): void

  /**
   * Get an array listing which data keys are present in this feature.
   */
  tags(): string[]

  /**
   * Get the unique ID of this feature.
   */
  id(): string

  /**
   * Get this feature's parent feature, or undefined if none.
   */
  parent(): Feature | undefined

  /**
   * Get an array of child features, or undefined if none.
   */
  children(): Feature[] | undefined

  /*
   * Convert to JSON
   */
  // @ts-ignore unspecified JSON record
  toJSON(): Record<string, any>
}

interface SimpleFeatureArgs {
  // @ts-ignore unspecified JSON record
  data: Record<string, any>
  parent?: Feature
  id?: any
}
/**
 * Simple implementation of a feature object.
 */
export default class SimpleFeature implements Feature {
  private data: Record<string, any>

  private parentHandle?: Feature

  private uniqueId: string

  /**
   * @param args.data {Object} key-value data, must include 'start' and 'end'
   * @param args.parent {Feature} optional parent feature
   * @param args.id {String} unique identifier.  can also be in data.uniqueID.
   * @param args.data.uniqueId {String} alternate location of the unique identifier
   *
   * Note: args.data.subfeatures can be an array of these same args,
   * which will be inflated to more instances of this class.
   */
  public constructor(args: SimpleFeatureArgs) {
    // this.data becomes args.data or from args itself
    this.data = args.data || args

    // load handle from args.parent (not args.data.parent)
    // this reason is because if args is an object, it likely isn't properly loaded with
    // parent as a Feature reference (probably a raw parent ID or something instead)
    this.parentHandle = args.parent

    // the feature id comes from
    // args.id, args.data.uniqueId, or args.uniqueId due to this initialization
    const id = args.id || this.data.uniqueId

    if (id === undefined || id === null) {
      throw new Error(
        'SimpleFeature requires a unique `id` or `data.uniqueId` attribute',
      )
    }
    // stringified
    this.uniqueId = String(id)

    if (!(this.data.aliases || this.data.end - this.data.start >= 0)) {
      throw new Error('invalid feature data')
    }

    // inflate any subfeatures that are not already feature objects
    const { subfeatures } = this.data
    if (subfeatures) {
      for (let i = 0; i < subfeatures.length; i += 1) {
        if (typeof subfeatures[i].get !== 'function') {
          subfeatures[i] = new SimpleFeature({
            data: subfeatures[i] as Record<string, any>,
            parent: this,
          })
        }
      }
    }
  }

  /**
   * Get a piece of data about the feature.  All features must have
   * 'start' and 'end', but everything else is optional.
   */
  public get(name: string): any {
    return this.data[name]
  }

  /**
   * Set an item of data.
   */
  public set(name: string, val: any): void {
    this.data[name] = val
  }

  /**
   * Get an array listing which data keys are present in this feature.
   */
  public tags(): string[] {
    return Object.keys(this.data)
  }

  /**
   * Get the unique ID of this feature.
   */
  public id(): string {
    return this.uniqueId
  }

  /**
   * Get this feature's parent feature, or undefined if none.
   */
  public parent(): Feature | undefined {
    return this.parentHandle
  }

  /**
   * Get an array of child features, or undefined if none.
   */
  public children(): Feature[] | undefined {
    return this.get('subfeatures')
  }

  // @ts-ignore unspecified types can be returned from Feature
  public toJSON(): Record<string, any> {
    const d = { ...this.data, uniqueId: this.id() }
    const p = this.parent()
    if (p) {
      // @ts-ignore doesn't need to have parentId in it if there is none
      d.parentId = p.id()
    }
    return d
  }

  public static fromJSON(json: SimpleFeatureArgs): Feature {
    return new SimpleFeature({ ...json })
  }
}

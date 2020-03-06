/**
 * Abstract feature object
 */
export interface Feature {
  /**
   * Get a piece of data about the feature.  All features must have
   * 'start' and 'end', but everything else is optional.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(name: string): any

  /**
   * Set an item of data.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  toJSON(): SimpleFeatureSerialized
}

// difficult to formalize type but see comments in constructor
export interface SimpleFeatureArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
  parent?: Feature
  id?: string | number // thing that can be stringified easily
}
export interface SimpleFeatureSerialized {
  parentId?: string
  subfeatures?: SimpleFeatureSerialized[]
  uniqueId: string
}

function isSimpleFeatureSerialized(
  args: SimpleFeatureSerialized | SimpleFeatureArgs,
): args is SimpleFeatureSerialized {
  return !('data' in args) && !('id' in args)
}

/**
 * Simple implementation of a feature object.
 */
export default class SimpleFeature implements Feature {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private data: Record<string, any>

  private parentHandle?: Feature

  private uniqueId: string

  /**
   * @param args.data {Object} key-value data, must include 'start' and 'end'
   * @param args.parent {Feature} optional parent feature
   * @param args.id {String} unique identifier.  can also be in data.uniqueId.
   * @param args.data.uniqueId {String} alternate location of the unique identifier
   *
   * Note: args.data.subfeatures can be an array of these same args,
   * which will be inflated to more instances of this class.
   */
  public constructor(args: SimpleFeatureArgs | SimpleFeatureSerialized) {
    if (isSimpleFeatureSerialized(args)) {
      this.data = args
    } else {
      this.data = args.data
      // load handle from args.parent (not args.data.parent)
      // this reason is because if args is an object, it likely isn't properly loaded with
      // parent as a Feature reference (probably a raw parent ID or something instead)
      this.parentHandle = args.parent
    }

    // the feature id comes from
    // args.id, args.data.uniqueId, or args.uniqueId due to this initialization
    const id = isSimpleFeatureSerialized(args) ? args.uniqueId : args.id
    if (id === undefined || id === null) {
      throw new Error(
        'SimpleFeature requires a unique `id` or `data.uniqueId` attribute',
      )
    }
    this.uniqueId = String(id)

    if (!(this.data.aliases || this.data.end - this.data.start >= 0)) {
      throw new Error(
        `invalid feature data, end less than start. end: ${this.data.end} start: ${this.data.start}`,
      )
    }

    // inflate any subfeatures that are not already feature objects
    const { subfeatures } = this.data
    if (subfeatures) {
      for (let i = 0; i < subfeatures.length; i += 1) {
        if (typeof subfeatures[i].get !== 'function') {
          subfeatures[i].strand = subfeatures[i].strand || this.data.strand
          subfeatures[i] = new SimpleFeature({
            id: subfeatures[i].uniqueId || `${id}-${i}`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get(name: string): any {
    return this.data[name]
  }

  /**
   * Set an item of data.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  public toJSON(): SimpleFeatureSerialized {
    const d = { ...this.data, uniqueId: this.id() } as SimpleFeatureSerialized
    const p = this.parent()
    if (p) d.parentId = p.id()
    const c = this.children()
    if (c) d.subfeatures = c.map(child => child.toJSON())
    return d
  }

  public static fromJSON(json: SimpleFeatureSerialized) {
    return new SimpleFeature({ ...json })
  }
}

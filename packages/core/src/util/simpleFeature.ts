/**
 * Abstract feature object
 */
export interface Feature {
  /**
   * Get a piece of data about the feature.  All features must have
   * 'start' and 'end', but everything else is optional.
   */
  get(name: 'refName'): string
  get(name: 'name' | 'type' | 'id' | 'source'): string | undefined
  get(name: 'start' | 'end'): number
  get(name: 'phase'): 0 | 1 | 2 | undefined
  get(name: 'strand'): -1 | 0 | 1 | undefined
  get(name: 'score'): number | undefined
  get(name: 'subfeatures'): Feature[] | undefined

  get(name: string): unknown
  /**
   * Get the unique ID of this feature.
   */
  id(): string

  /**
   * Get this feature's parent feature, or undefined if none.
   */
  parent?: () => Feature | undefined

  /**
   * Get an array of child features, or undefined if none.
   */
  children?: () => Feature[] | undefined

  /**
   * Convert to JSON
   */
  toJSON(): SimpleFeatureSerialized
}

export function isFeature(thing: unknown): thing is Feature {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    typeof (thing as Feature).get === 'function' &&
    typeof (thing as Feature).id === 'function'
  )
}

/**
 * Wrap a feature so jexl callbacks can read attributes as plain properties
 * (`feature.score`) instead of `get(feature,'score')`. Since jexl has no
 * member-call syntax, attributes resolve to values: any property (including
 * `id`, i.e. a data field such as a GFF3 `ID=`) is forwarded to
 * `feature.get(name)` where a SimpleFeature keeps its data, and `parent`
 * resolves to the parent feature (re-wrapped so `feature.parent.type` works).
 * `get` is the one method kept callable, so the legacy
 * `get(feature,'x')`/`getTag(feature,'x')` forms still work; the `parent`/`id`
 * jexl functions tolerate the value form (see jexl.ts).
 */
export function jexlFeatureProxy(feature: Feature): Feature {
  return new Proxy(feature, {
    get(target, prop) {
      if (typeof prop !== 'string') {
        return Reflect.get(target, prop)
      }
      if (prop === 'get') {
        return target.get.bind(target)
      }
      if (prop === 'parent') {
        const p = target.parent?.()
        return p ? jexlFeatureProxy(p) : undefined
      }
      return target.get(prop)
    },
  })
}

export interface SimpleFeatureArgs {
  /** key-value data, must include 'start' and 'end' */
  data: Record<string, unknown>
  /** optional parent feature */
  parent?: Feature
  /** unique identifier. can also be in data.uniqueId */
  id: string | number // thing that can be stringified easily
}

// subfeatures do not have to have uniqueId
export interface SimpleFeatureSerializedNoId {
  [key: string]: unknown
  parentId?: string
  start: number
  end: number
  refName: string
  type?: string
  strand?: number
  name?: string
  id?: string | number
  __jbrowsefmt?: Record<string, unknown>
  mate?: { refName: string; start: number; end: number; [key: string]: unknown }
  subfeatures?: SimpleFeatureSerializedNoId[]
}

// base serialized feature has to have a uniqueId
export interface SimpleFeatureSerialized extends SimpleFeatureSerializedNoId {
  subfeatures?: SimpleFeatureSerializedNoId[]
  uniqueId: string
}

function isSimpleFeatureSerialized(
  args: SimpleFeatureSerialized | SimpleFeatureArgs,
): args is SimpleFeatureSerialized {
  return 'uniqueId' in args
}

/**
 * Simple implementation of a feature object.
 */
export default class SimpleFeature implements Feature {
  private data: Record<string, any>

  private subfeatures?: SimpleFeature[]

  private parentHandle?: Feature

  private uniqueId: string

  /**
   * @param args - SimpleFeature args
   *
   * Note: args.data.subfeatures can be an array of these same args,
   * which will be inflated to more instances of this class.
   */
  public constructor(args: SimpleFeatureArgs | SimpleFeatureSerialized) {
    if (isSimpleFeatureSerialized(args)) {
      this.data = args
    } else {
      this.data = args.data
      // load handle from args.parent (not args.data.parent) this reason is
      // because if args is an object, it likely isn't properly loaded with
      // parent as a Feature reference (probably a raw parent ID or something
      // instead)
      this.parentHandle = args.parent
    }

    // the feature id comes from args.id, args.data.uniqueId, or args.uniqueId
    // due to this initialization
    const id = isSimpleFeatureSerialized(args) ? args.uniqueId : args.id

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
    if (this.data.subfeatures) {
      this.subfeatures = this.data.subfeatures?.map((f: any, i: number) =>
        typeof f.get !== 'function'
          ? new SimpleFeature({
              id: f.uniqueId || `${id}-${i}`,
              data: {
                strand: this.data.strand,
                ...f,
              } as Record<string, unknown>,
              parent: this,
            })
          : f,
      )
    }
  }

  /**
   * Get a piece of data about the feature.  All features must have
   * 'start' and 'end', but everything else is optional.
   */
  get(name: 'refName'): string
  get(name: 'name' | 'type' | 'id' | 'source'): string | undefined
  get(name: 'start' | 'end'): number
  get(name: 'phase'): 0 | 1 | 2 | undefined
  get(name: 'strand'): -1 | 0 | 1 | undefined
  get(name: 'score'): number | undefined
  get(name: 'subfeatures'): Feature[] | undefined
  get(name: string): unknown
  public get(name: string): unknown {
    return name === 'subfeatures'
      ? this.subfeatures
      : name === 'parent'
        ? this.parent()
        : this.data[name]
  }

  /**
   * Set an item of data.
   */

  public set(name: string, val: unknown): void {
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
    return this.subfeatures
  }

  public toJSON(): SimpleFeatureSerialized {
    const d = { ...this.data, uniqueId: this.id() } as SimpleFeatureSerialized
    const p = this.parent()
    if (p) {
      d.parentId = p.id()
    }
    const c = this.children()
    if (c) {
      d.subfeatures = c.map(child => child.toJSON())
    }
    return d
  }

  public static fromJSON(json: SimpleFeatureSerialized) {
    return new SimpleFeature({ ...json })
  }
}

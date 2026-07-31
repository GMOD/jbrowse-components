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

// brand carried by jexlFeatureProxy so the real feature can be recovered from a
// proxy whose properties all resolve to data values
const featureTarget = Symbol('featureTarget')

interface MaybeProxiedFeature {
  [featureTarget]?: Feature
}

export function isFeature(thing: unknown): thing is Feature {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    typeof (thing as Feature).get === 'function' &&
    (typeof (thing as Feature).id === 'function' || featureTarget in thing)
  )
}

/**
 * Recover the underlying feature from a jexlFeatureProxy, or return a raw
 * feature untouched. Needed by callers that want the feature's methods
 * (`id()`, `parent()`) rather than the data value the proxy resolves a
 * property to.
 */
export function unwrapFeature(feature: Feature & MaybeProxiedFeature): Feature {
  return feature[featureTarget] ?? feature
}

/**
 * Wrap a feature so jexl callbacks can read attributes as plain properties
 * (`feature.score`) instead of `get(feature,'score')`. Since jexl has no
 * member-call syntax, attributes resolve to values: any property (including
 * `id`, i.e. a data field such as a GFF3 `ID=`) is forwarded to
 * `feature.get(name)` where a SimpleFeature keeps its data. Exceptions:
 * `parent` resolves to the parent feature (re-wrapped so `feature.parent.type`
 * works), `uniqueId` to the feature's identity (`id()`) so it reads the same
 * whether or not the feature happens to keep a uniqueId in its data, and
 * `get`/`toJSON` stay callable methods so the legacy
 * `get(feature,'x')`/`getTag(feature,'x')` forms and serialization still work.
 * The `parent`/`id` jexl functions unwrap the proxy (see jexl.ts).
 */
export function jexlFeatureProxy(
  feature: Feature & MaybeProxiedFeature,
): Feature {
  return feature[featureTarget]
    ? feature
    : new Proxy(feature, {
        has(target, prop) {
          return prop === featureTarget || Reflect.has(target, prop)
        },
        get(target, prop) {
          switch (prop) {
            case featureTarget: {
              return target
            }
            case 'get': {
              return target.get.bind(target)
            }
            case 'toJSON': {
              return target.toJSON.bind(target)
            }
            case 'uniqueId': {
              return target.id()
            }
            case 'parent': {
              const p = target.parent?.()
              return p ? jexlFeatureProxy(p) : undefined
            }
            default: {
              return typeof prop === 'string'
                ? target.get(prop)
                : Reflect.get(target, prop)
            }
          }
        },
      })
}

/**
 * Build the variable bindings a jexl callback evaluates against, wrapping any
 * `Feature`-valued entry in `jexlFeatureProxy` (so `x.attr` reads directly while
 * `get(x,'attr')` still works) and passing everything else through untouched.
 *
 * The single context-construction path shared by config-slot evaluation
 * (`evaluateJexl`) and the filter chain (`SerializableFilterChain`), so which
 * variables a callback can reference — and how a feature is exposed — never
 * depends on which call site invoked it.
 */
export function buildJexlContext(args: Record<string, unknown>) {
  const context: Record<string, unknown> = {}
  for (const key in args) {
    const value = args[key]
    context[key] = isFeature(value) ? jexlFeatureProxy(value) : value
  }
  return context
}

export interface SimpleFeatureArgs {
  /** key-value data, must include 'start' and 'end' */
  data: Record<string, unknown>
  /** optional parent feature */
  parent?: Feature
  /**
   * unique identifier, stringified. the serialized form
   * (SimpleFeatureSerialized) carries it as `uniqueId` instead
   */
  id: string | number
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
  uniqueId?: string
  __jbrowsefmt?: Record<string, unknown>
  mate?: { refName: string; start: number; end: number; [key: string]: unknown }
  subfeatures?: SimpleFeatureSerializedNoId[]
}

// base serialized feature has to have a uniqueId
export interface SimpleFeatureSerialized extends SimpleFeatureSerializedNoId {
  uniqueId: string
}

function isSimpleFeatureSerialized(
  args: SimpleFeatureSerialized | SimpleFeatureArgs,
): args is SimpleFeatureSerialized {
  return 'uniqueId' in args
}

// a feature is valid if it has a non-inverted interval, or is a bare reference
// sequence alias record: aliases and no coordinates at all (e.g. what
// FromConfigAdapter yields when used as a refNameAliases adapter). A feature
// that carries coordinates is still validated even if it also happens to have
// an aliases attribute
function validateFeatureData(data: Record<string, unknown>, uniqueId: string) {
  const { aliases, start, end } = data
  const aliasRecord = !!aliases && start === undefined && end === undefined
  if (!aliasRecord) {
    if (typeof start !== 'number' || typeof end !== 'number') {
      throw new Error(
        `invalid feature data for "${uniqueId}", start and end must be numbers. start: ${start} end: ${end}`,
      )
    }
    // written as a negated >= so NaN coordinates are rejected too
    if (!(end >= start)) {
      throw new Error(
        `invalid feature data for "${uniqueId}", end less than start. end: ${end} start: ${start}`,
      )
    }
  }
}

/**
 * Simple implementation of a feature object.
 */
export default class SimpleFeature implements Feature {
  private data: Record<string, unknown>

  private subfeatures?: Feature[]

  private parentHandle?: Feature

  private uniqueId: string

  /**
   * @param args - SimpleFeature args
   *
   * Note: args.data.subfeatures can be an array of these same args,
   * which will be inflated to more instances of this class.
   */
  public constructor(args: SimpleFeatureArgs | SimpleFeatureSerialized) {
    const serialized = isSimpleFeatureSerialized(args)
    if (serialized) {
      this.data = args
    } else {
      this.data = args.data
      // load handle from args.parent (not args.data.parent): a plain args
      // object likely carries a raw parent id rather than a Feature reference
      this.parentHandle = args.parent
    }

    const id = serialized ? args.uniqueId : args.id
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (id === undefined || id === null) {
      throw new Error('SimpleFeature requires an `id` or `uniqueId` attribute')
    }
    this.uniqueId = String(id)

    validateFeatureData(this.data, this.uniqueId)

    this.subfeatures = this.inflateSubfeatures()
  }

  // raw subfeatures arrive as either plain arg objects or already-inflated
  // features; inflate the former into SimpleFeature instances, inheriting this
  // feature's strand when a subfeature doesn't specify its own. The result is
  // kept in a separate field so the caller's input data is never mutated
  // (features are effectively immutable)
  private inflateSubfeatures(): Feature[] | undefined {
    const raw = this.data.subfeatures
    return Array.isArray(raw)
      ? raw.map((f: SimpleFeatureSerializedNoId | Feature, i) =>
          isFeature(f)
            ? f
            : new SimpleFeature({
                id: f.uniqueId ?? `${this.uniqueId}-${i}`,
                data: { ...f, strand: f.strand ?? this.data.strand },
                parent: this,
              }),
        )
      : undefined
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

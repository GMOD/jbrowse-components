import { getAttribute, getAttributes } from '@gmod/gff-nostream'
import { featureItemRgb } from '@jbrowse/core/util/colorBits'

import { fileAttributes } from './fileAttributes.ts'

import type { LazyGffFeature } from '@gmod/gff-nostream'
import type {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'

/**
 * A {@link Feature} over a GFF3 feature whose attributes are still raw column-9
 * text, resolving each one only when something asks for it.
 *
 * This exists because the two things that read a GFF3 feature want opposite
 * amounts of it. Rendering reads the fixed columns and a few attributes —
 * `name`/`id` for labels, `gbkey` for the stock NCBI filter, and the BED color
 * keys, which `inheritedBedColor` asks of every box and each of its ancestors —
 * and then packs the result into typed arrays, so the feature objects are
 * dropped and never cross the RPC boundary.
 * The feature details panel wants everything, and re-fetches the region from
 * scratch to get it (`GetBasicFeatureDetails`). Parsing every attribute during
 * a render therefore did work that rendering did not use and that the details
 * path did not reuse.
 *
 * `toJSON` still materializes the lot, which is what the details path
 * serializes, so nothing downstream sees a smaller feature than it used to.
 */
const BED_COLOR_TAG = /itemrgb|reserved|field8/i

export class Gff3Feature implements Feature {
  private inflated?: Feature[]

  // each attribute read scans column 9, and the color walk repeats the same
  // reads on an ancestor once per descendant box
  private attributes?: Map<string, unknown>

  public constructor(
    private data: LazyGffFeature,
    private uniqueId: string,
    private parentFeature?: Feature,
  ) {}

  /**
   * A switch rather than a lookup table or a `data[name]` fallthrough: the
   * fixed columns are read tens of times per feature by the layout pass, and
   * they must not pay for an attribute scan. Anything not named here is an
   * attribute, resolved on demand.
   */
  // the overload set is Feature's, restated so callers keep the narrow return
  // types they get from a SimpleFeature
  public get(name: 'refName'): string
  public get(name: 'name' | 'type' | 'id' | 'source'): string | undefined
  public get(name: 'start' | 'end'): number
  public get(name: 'phase'): 0 | 1 | 2 | undefined
  public get(name: 'strand'): -1 | 0 | 1 | undefined
  public get(name: 'score'): number | undefined
  public get(name: 'subfeatures'): Feature[] | undefined
  public get(name: string): unknown
  public get(name: string): unknown {
    switch (name) {
      case 'start': {
        return this.data.start
      }
      case 'end': {
        return this.data.end
      }
      case 'type': {
        return this.data.type
      }
      case 'refName': {
        return this.data.refName
      }
      case 'source': {
        return this.data.source
      }
      case 'score': {
        return this.data.score
      }
      case 'phase': {
        return this.data.phase
      }
      case 'strand': {
        // a subfeature with no strand column of its own inherits its parent's,
        // which is what SimpleFeature does too — it resolves the same way here,
        // through the parent handle rather than by copying the field down
        return this.data.strand ?? this.parentFeature?.get('strand')
      }
      case 'subfeatures': {
        return this.children()
      }
      case 'parent': {
        return this.parentFeature
      }
      default: {
        return this.attribute(name)
      }
    }
  }

  private attribute(name: string) {
    this.attributes ??= new Map()
    const cached = this.attributes.get(name)
    if (cached !== undefined || this.attributes.has(name)) {
      return cached
    }
    const value = getAttribute(this.data, name)
    this.attributes.set(name, value)
    return value
  }

  public id() {
    return this.uniqueId
  }

  /**
   * The BED color that "Save track data" writes into a GFF3 as an `itemRgb`,
   * `reserved` or `field8` attribute, read back for `featureBedColor`. The
   * parser lowercases tags, so the names are looked up lowercased. Most GFF3
   * has none of them, so this tests column 9 with one regex before scanning
   * for any attribute.
   */
  public bedColor(itemRgbOn: boolean) {
    if (!BED_COLOR_TAG.test(this.data.attributeString)) {
      return undefined
    }
    let found: string | undefined
    for (const key of ['itemrgb', 'reserved', 'field8']) {
      found ??= featureItemRgb(this.attribute(key), itemRgbOn)
    }
    return found
  }

  /** The feature's column 9 keyed as the file writes it (`fileAttributes`). */
  public fileAttributes() {
    return fileAttributes(this.data.attributeString)
  }

  public parent() {
    return this.parentFeature
  }

  /**
   * Wrapped lazily rather than in the constructor: a feature the layout pass
   * never reaches never allocates a wrapper per descendant. (SimpleFeature
   * inflates its whole subtree eagerly on construction.)
   */
  public children() {
    this.inflated ??= this.data.subfeatures.map(
      (f, i) => new Gff3Feature(f, `${this.uniqueId}-${i}`, this),
    )
    return this.inflated
  }

  public tags() {
    return [
      ...Object.keys(this.columns()),
      'subfeatures',
      ...Object.keys(getAttributes(this.data)),
    ]
  }

  // the eight parsed columns, without the raw attribute text or the nested
  // features, both of which the serialized form carries differently
  private columns() {
    const { attributeString, subfeatures, ...rest } = this.data
    return rest
  }

  public toJSON(): SimpleFeatureSerialized {
    const d = {
      ...this.columns(),
      ...getAttributes(this.data),
      strand: this.get('strand'),
      uniqueId: this.uniqueId,
      subfeatures: this.children().map(f => f.toJSON()),
    } as SimpleFeatureSerialized
    if (this.parentFeature) {
      d.parentId = this.parentFeature.id()
    }
    return d
  }
}

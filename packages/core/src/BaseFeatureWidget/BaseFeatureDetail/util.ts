import { coarseStripHTML, isObject } from '../../util/index.ts'

export function isEmpty(obj: Record<string, unknown>) {
  return Object.keys(obj).length === 0
}

function plainText(value: unknown) {
  const text = value == null ? '' : coarseStripHTML(String(value)).trim()
  return text === '' ? undefined : text
}

/**
 * What names a feature to a reader: its readable name (`name`, else e.g.
 * `transcript_name`), then its accession (e.g. `transcript_id`, else `id`)
 * when the accession does not already spell the name out
 */
export function featureLabel(feature: Record<string, unknown>) {
  const { type } = feature
  const readable =
    plainText(feature.name) ?? plainText(feature[`${String(type)}_name`])
  const accession =
    plainText(feature[`${String(type)}_id`]) ?? plainText(feature.id)
  return readable !== undefined &&
    accession !== undefined &&
    !accession.includes(readable)
    ? `${readable} · ${accession}`
    : (readable ?? accession)
}

export function generateTitle(feature: Record<string, unknown>) {
  return [featureLabel(feature), plainText(feature.type)]
    .filter(part => part !== undefined)
    .join(' · ')
}

// the description at `arr` in a descriptions tree: a string there, or the
// `Description` of the object there, as a VCF header entry carries. A path
// that runs out of objects early has none
export function accessNested(arr: string[], obj: Record<string, unknown> = {}) {
  let obj2: unknown = obj
  for (const elt of arr) {
    obj2 = isObject(obj2) ? obj2[elt] : undefined
  }
  return typeof obj2 === 'string'
    ? obj2
    : isObject(obj2) && typeof obj2.Description === 'string'
      ? obj2.Description
      : undefined
}

// the value at `path` in a feature, with a one-element array read as its
// element, as a details row draws it
export function valueAt(path: string[], obj: Record<string, unknown>) {
  let value: unknown = obj
  for (const elt of path) {
    value = isObject(value) ? value[elt] : undefined
  }
  return Array.isArray(value) ? onlyElement(value) : value
}

function onlyElement(arr: readonly unknown[]) {
  return arr.length === 1 ? arr[0] : arr
}

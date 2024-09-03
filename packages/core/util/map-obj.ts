// adapted from map-obj (MIT), with modifications to pass the "whole object"
// from an array of objects into itself
const isObject = (value: unknown) => typeof value === 'object' && value !== null

// Customized for this use-case
const isObjectCustom = (value: unknown) =>
  isObject(value) &&
  !(value instanceof RegExp) &&
  !(value instanceof Error) &&
  !(value instanceof Date) &&
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  !(globalThis.Blob && value instanceof globalThis.Blob)

type Obj = Record<string, unknown>

export default function map(
  object: Obj,
  mapper: (val: unknown) => void,
  isSeen = new WeakSet(),
) {
  if (isSeen.has(object)) {
    return
  }

  isSeen.add(object)

  const mapArray = (array: unknown[]) => {
    array.forEach(element => {
      mapper(element)
      if (isObject(element)) {
        map(element as Record<string, unknown>, mapper, isSeen)
      }
    })
  }

  if (Array.isArray(object)) {
    mapArray(object)
  }

  for (const value of Object.values(object)) {
    mapper(value)

    if (isObjectCustom(value)) {
      if (Array.isArray(value)) {
        mapArray(value)
      } else {
        map(value as Obj, mapper, isSeen)
      }
    }
  }
}

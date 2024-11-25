import {
  getPropertyMembers,
  getChildType,
  isArrayType,
  isModelType,
  isReferenceType,
  isValidReference,
  isMapType,
} from 'mobx-state-tree'
import type {
  types,
  IAnyType,
  IAnyStateTreeNode,
  Instance,
} from 'mobx-state-tree'

/**
 * Pad the end of a base64 string with "=" to make it valid
 * @param b64 - unpadded b64 string
 */
export function b64PadSuffix(b64: string): string {
  let num = 0
  const mo = b64.length % 4
  switch (mo) {
    case 3:
      num = 1
      break
    case 2:
      num = 2
      break
    case 0:
      num = 0
      break
    default:
      throw new Error('base64 not a valid length')
  }
  return b64 + '='.repeat(num)
}

/**
 * Decode and inflate a url-safe base64 to a string
 * See {@link https://en.wikipedia.org/wiki/Base64#URL_applications}
 * @param b64 - a base64 string to decode and inflate
 */
export async function fromUrlSafeB64(b64: string) {
  const originalB64 = b64PadSuffix(
    b64.replaceAll('-', '+').replaceAll('_', '/'),
  )
  const { toByteArray } = await import('base64-js')
  const { inflate } = await import('pako')
  const bytes = toByteArray(originalB64)
  const inflated = inflate(bytes)
  return new TextDecoder().decode(inflated)
}

/**
 * Compress and encode a string as url-safe base64
 * See {@link https://en.wikipedia.org/wiki/Base64#URL_applications}
 * @param str-  a string to compress and encode
 */
export async function toUrlSafeB64(str: string) {
  const bytes = new TextEncoder().encode(str)
  const { deflate } = await import('pako')
  const { fromByteArray } = await import('base64-js')
  const deflated = deflate(bytes)
  const encoded = fromByteArray(deflated)
  const pos = encoded.indexOf('=')
  return pos > 0
    ? encoded.slice(0, pos).replaceAll('+', '-').replaceAll('/', '_')
    : encoded.replaceAll('+', '-').replaceAll('/', '_')
}

type MSTArray = Instance<ReturnType<typeof types.array>>
type MSTMap = Instance<ReturnType<typeof types.map>>

// attempts to remove undefined references from the given MST model. can only
// actually remove them from arrays and maps. throws MST undefined ref error if
// it encounters undefined refs in model properties
export function filterSessionInPlace(
  node: IAnyStateTreeNode | undefined,
  type: IAnyType,
) {
  // makes it work with session sharing
  if (node === undefined) {
    return
  }
  if (isArrayType(type)) {
    const array = node as MSTArray
    const childType = getChildType(node)
    if (isReferenceType(childType)) {
      // filter array elements
      for (let i = 0; i < array.length; ) {
        if (!isValidReference(() => array[i])) {
          array.splice(i, 1)
        } else {
          i += 1
        }
      }
    }
    array.forEach(el => {
      filterSessionInPlace(el, childType)
    })
  } else if (isMapType(type)) {
    const map = node as MSTMap
    const childType = getChildType(map)
    if (isReferenceType(childType)) {
      // filter the map members
      for (const key in map.keys()) {
        if (!isValidReference(() => map.get(key))) {
          map.delete(key)
        }
      }
    }
    map.forEach(child => {
      filterSessionInPlace(child, childType)
    })
  } else if (isModelType(type)) {
    // iterate over children
    const { properties } = getPropertyMembers(node)

    Object.entries(properties).forEach(([pname, ptype]) => {
      // @ts-ignore
      filterSessionInPlace(node[pname], ptype)
    })
  }
}

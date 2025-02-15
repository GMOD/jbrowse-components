/**
 * Ensure that passed value is object
 * @param object Value to check
 * @returns Check result
 */
export function isObject(object: any): object is Record<string, unknown> {
  return Object(object) === object
}

/**
 * Ensure that passed value could be transfer
 * @param object - Value to check
 * @returns Check result
 */
export function isTransferable(object: any): object is Transferable {
  try {
    return (
      object instanceof ArrayBuffer ||
      object instanceof ImageBitmap ||
      object instanceof OffscreenCanvas ||
      object instanceof MessagePort
    )
  } catch (error) {
    return false
  }
}

/**
 * Recursively peek transferables from passed data
 * @param data - Data source
 * @param  {Array}         [result=[]] Dist array
 * @returns  List of transferables objects
 */
export function peekTransferables(data: unknown, result: Transferable[] = []) {
  if (isTransferable(data)) {
    result.push(data)
  } else if (isObject(data) && !('containsNoTransferables' in data)) {
    for (const value of Object.values(data)) {
      peekTransferables(value, result)
    }
  }
  return result
}

/**
 * @returns Uniq uid
 */
export function uuid() {
  return Math.floor((1 + Math.random()) * 1e10).toString(16)
}

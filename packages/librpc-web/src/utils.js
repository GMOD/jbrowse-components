/**
 * Ensure that passed value is object
 * @param  {*}       object Value to check
 * @return {boolean}        Check result
 */
export function isObject(object) {
  return Object(object) === object
}

/**
 * Ensure that passed value could be transfer
 * @param  {*}       object Value to check
 * @return {boolean}        Check result
 */
export function isTransferable(object) {
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
 * @param  {*}             data        Data source
 * @param  {Array}         [result=[]] Dist array
 * @return {ArrayBuffer[]}             List of transferables objects
 */
export function peekTransferables(data, result = []) {
  if (isTransferable(data)) {
    result.push(data)
  } else if (isObject(data)) {
    for (const i in data) {
      peekTransferables(data[i], result)
    }
  }
  return result
}

/**
 * @return {string} Uniq uid
 */
export function uuid() {
  return Math.floor((1 + Math.random()) * 1e10).toString(16)
}

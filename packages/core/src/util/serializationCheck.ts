/**
 * Utility to diagnose DataCloneError issues which provide poor stack traces.
 * Only runs diagnostics after an error is detected to avoid performance overhead.
 */

/**
 * Finds paths to non-serializable values in an object.
 * This helps debug DataCloneError by identifying exactly which field causes issues.
 *
 * @param obj - The object to check
 * @param maxDepth - Maximum depth to recurse (default 20)
 * @returns Array of {path, value, reason} for non-serializable values
 */
export function findNonSerializable(
  obj: unknown,
  maxDepth = 20,
): { path: string; value: unknown; reason: string }[] {
  const issues: { path: string; value: unknown; reason: string }[] = []
  const seen = new WeakSet()

  function check(value: unknown, path: string, depth: number) {
    if (depth > maxDepth) {
      return
    }

    if (value === null || value === undefined) {
      return
    }

    const type = typeof value

    // Primitives are always serializable
    if (
      type === 'string' ||
      type === 'number' ||
      type === 'boolean' ||
      type === 'bigint'
    ) {
      return
    }

    // Functions are never serializable
    if (type === 'function') {
      issues.push({ path, value, reason: 'function' })
      return
    }

    // Symbols are not serializable
    if (type === 'symbol') {
      issues.push({ path, value, reason: 'symbol' })
      return
    }

    if (type === 'object') {
      // Avoid circular references
      if (seen.has(value as object)) {
        return
      }
      seen.add(value as object)

      // Check for specific non-serializable types
      if (value instanceof Error) {
        issues.push({ path, value, reason: 'Error object' })
        return
      }

      if (value instanceof Map) {
        issues.push({ path, value, reason: 'Map (use Object or array instead)' })
        return
      }

      if (value instanceof Set) {
        issues.push({ path, value, reason: 'Set (use array instead)' })
        return
      }

      if (value instanceof WeakMap || value instanceof WeakSet) {
        issues.push({ path, value, reason: 'WeakMap/WeakSet' })
        return
      }

      if (value instanceof Promise) {
        issues.push({ path, value, reason: 'Promise' })
        return
      }

      if (typeof Element !== 'undefined' && value instanceof Element) {
        issues.push({ path, value, reason: 'DOM Element' })
        return
      }

      if (typeof Node !== 'undefined' && value instanceof Node) {
        issues.push({ path, value, reason: 'DOM Node' })
        return
      }

      // These are serializable via structured clone
      if (
        value instanceof ArrayBuffer ||
        value instanceof DataView ||
        ArrayBuffer.isView(value) ||
        value instanceof Blob ||
        value instanceof File ||
        value instanceof Date ||
        value instanceof RegExp ||
        (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap) ||
        (typeof ImageData !== 'undefined' && value instanceof ImageData)
      ) {
        return
      }

      // Recurse into arrays
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          check(value[i], `${path}[${i}]`, depth + 1)
        }
        return
      }

      // Recurse into plain objects
      try {
        for (const [key, val] of Object.entries(value)) {
          check(val, `${path}.${key}`, depth + 1)
        }
      } catch {
        // Object.entries might fail on some objects
        issues.push({ path, value, reason: 'Object.entries failed' })
      }
    }
  }

  check(obj, 'root', 0)
  return issues
}

/**
 * Checks if an error is a DataCloneError (serialization failure).
 */
export function isDataCloneError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'DataCloneError' ||
      error.message.includes('could not be cloned'))
  )
}

/**
 * Enhances a DataCloneError with diagnostic information about what failed to serialize.
 * Call this in a catch block when you suspect serialization issues.
 *
 * @param originalError - The caught error
 * @param data - The data that was being serialized
 * @param context - Description of what was being serialized
 * @returns Enhanced error with path information, or original error if not a clone error
 */
export function diagnoseSerializationError(
  originalError: unknown,
  data: unknown,
  context: string,
): Error {
  if (!isDataCloneError(originalError)) {
    return originalError instanceof Error
      ? originalError
      : new Error(String(originalError))
  }

  const issues = findNonSerializable(data)
  if (issues.length > 0) {
    const details = issues
      .slice(0, 10)
      .map(i => `  - ${i.path}: ${i.reason}`)
      .join('\n')
    const suffix =
      issues.length > 10 ? `\n  ... and ${issues.length - 10} more` : ''
    const enhanced = new Error(
      `DataCloneError in ${context}. Non-serializable values found:\n${details}${suffix}`,
    )
    enhanced.cause = originalError
    return enhanced
  }

  return originalError instanceof Error
    ? originalError
    : new Error(String(originalError))
}

/**
 * Static configuration reader for web workers
 *
 * This module provides fast, MobX-free config reading for use in web workers
 * where we don't need observable behavior - just fast static reads.
 *
 * Usage:
 *   // Main thread - before sending to worker
 *   const configSnapshot = getSnapshot(config)
 *   postMessage({ config: configSnapshot, ... })
 *
 *   // Worker - receives plain object
 *   const value = readStaticConfObject(configSnapshot, 'height')
 *   const label = readStaticConfObject(configSnapshot, ['labels', 'name'], { feature }, jexl)
 */

// Cache for compiled jexl expressions - keyed by the jexl string
const compiledExprCache = new Map<string, any>()

// Jexl-like interface for type safety
interface JexlLike {
  compile: (expr: string) => { evalSync: (context: unknown) => unknown }
}

/**
 * Read a configuration value from a plain snapshot object.
 * Zero MobX overhead - just simple property access and jexl evaluation.
 *
 * @param snapshot - Plain object (not MST node) containing config values
 * @param slotPath - Property name or array of nested property names
 * @param args - Arguments for jexl callback evaluation (e.g., { feature, theme })
 * @param jexl - Jexl instance for evaluating callbacks (required if config has callbacks)
 * @returns The configuration value
 */
export function readStaticConfObject(
  snapshot: Record<string, any>,
  slotPath?: string | string[],
  args: Record<string, unknown> = {},
  jexl?: JexlLike,
): any {
  if (!snapshot) {
    return undefined
  }

  if (!slotPath) {
    return snapshot
  }

  // Navigate to the value
  let value: any
  if (typeof slotPath === 'string') {
    value = snapshot[slotPath]
  } else if (Array.isArray(slotPath)) {
    value = snapshot
    for (const key of slotPath) {
      if (value === undefined || value === null) {
        return undefined
      }
      value = value[key]
    }
  }

  // Handle jexl callbacks
  if (typeof value === 'string' && value.startsWith('jexl:')) {
    if (!jexl) {
      throw new Error(
        'Jexl instance required to evaluate callback: ' + slotPath,
      )
    }
    return evaluateJexl(value, args, jexl)
  }

  // Handle nested objects that might contain jexl values
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    // Check if this is a slot object with a 'value' property
    if ('value' in value) {
      const slotValue = value.value
      if (typeof slotValue === 'string' && slotValue.startsWith('jexl:')) {
        if (!jexl) {
          throw new Error(
            'Jexl instance required to evaluate callback: ' + slotPath,
          )
        }
        return evaluateJexl(slotValue, args, jexl)
      }
      return slotValue
    }
  }

  return value
}

/**
 * Evaluate a jexl expression string with caching of compiled expressions
 */
function evaluateJexl(
  jexlString: string,
  args: Record<string, unknown>,
  jexl: JexlLike,
): any {
  const exprString = jexlString.slice(5) // Remove 'jexl:' prefix

  let compiled = compiledExprCache.get(exprString)
  if (!compiled) {
    compiled = jexl.compile(exprString)
    compiledExprCache.set(exprString, compiled)
  }

  return compiled.evalSync(args)
}

/**
 * Batch read multiple config values at once.
 * More efficient than multiple readStaticConfObject calls.
 *
 * @param snapshot - Plain object containing config values
 * @param slots - Array of slot paths to read
 * @param args - Arguments for jexl callback evaluation
 * @param jexl - Jexl instance for evaluating callbacks
 * @returns Object mapping slot paths to their values
 */
export function readStaticConfObjectBatch(
  snapshot: Record<string, any>,
  slots: (string | string[])[],
  args: Record<string, unknown> = {},
  jexl?: JexlLike,
): Record<string, any> {
  const result: Record<string, any> = {}
  for (const slot of slots) {
    const key = Array.isArray(slot) ? slot.join('.') : slot
    result[key] = readStaticConfObject(snapshot, slot, args, jexl)
  }
  return result
}

/**
 * Helper to get static feature labels without MobX overhead
 */
export function readStaticFeatureLabels(
  snapshot: Record<string, any>,
  feature: unknown,
  jexl: JexlLike,
) {
  return {
    name: String(
      readStaticConfObject(snapshot, ['labels', 'name'], { feature }, jexl) ||
        '',
    ),
    description: String(
      readStaticConfObject(
        snapshot,
        ['labels', 'description'],
        { feature },
        jexl,
      ) || '',
    ),
  }
}

/**
 * Helper to get static label colors without MobX overhead
 */
export function readStaticLabelColors(
  snapshot: Record<string, any>,
  feature: unknown,
  theme: unknown,
  jexl: JexlLike,
) {
  return {
    nameColor: String(
      readStaticConfObject(
        snapshot,
        ['labels', 'nameColor'],
        { feature, theme },
        jexl,
      ) || '',
    ),
    descriptionColor: String(
      readStaticConfObject(
        snapshot,
        ['labels', 'descriptionColor'],
        { feature, theme },
        jexl,
      ) || '',
    ),
  }
}

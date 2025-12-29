import { nanoid } from '@jbrowse/core/util/nanoid'

export function renameIds(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const idMap = new Map<string, string>()

  function transformIds(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value
    }

    if (Array.isArray(value)) {
      return value.map(transformIds)
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(value)) {
        if (key === 'id' && typeof val === 'string') {
          if (!idMap.has(val)) {
            idMap.set(val, nanoid())
          }
          result[key] = `${val}-${idMap.get(val)}`
        } else {
          result[key] = transformIds(val)
        }
      }
      return result
    }

    return value
  }

  return transformIds(obj) as Record<string, unknown>
}

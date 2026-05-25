The bug is on line 19: when iterating keys with Object.entries, assigning result[key] = ... on a plain {} object will pollute Object.prototype if key is "__proto__". The current code rebuilds the entire object tree unnecessarily — structuredClone already gives a safe deep copy, so we can just mutate IDs in place:

import { createElementId } from '@jbrowse/core/util/types/mst'

export function renameIds(obj: Record<string, unknown>): Record<string, unknown> {
  const idMap = new Map<string, string>()
  const clone = structuredClone(obj)

  function walk(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(walk)
    } else if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>
      if (typeof record['id'] === 'string') {
        if (!idMap.has(record['id'])) {
          idMap.set(record['id'], createElementId())
        }
        record['id'] = idMap.get(record['id'])!
      }
      for (const val of Object.values(record)) {
        walk(val)
      }
    }
  }

  walk(clone)
  return clone
}

Key changes:
- structuredClone does the deep copy safely — it never assigns to __proto__ as a property key
- In-place mutation replaces the rebuild-from-scratch approach, removing the need to reconstruct every object/array in the tree
- The ! on idMap.get is safe — we just set it in the branch above
- walk is 4 lines shorter with cleaner intent: "clone then mutate" vs "transform while copying"

The only tradeoff: structuredClone doesn't handle non-JSON types (functions, undefined values, etc.), but MST snapshots are always JSON-serializable so that's fine here.

✻ Cogitated for 53s

❯ great. do one more pass to ensure the most ideal simple clean implementation here. you can add
  testing if it helps also

Let me check if there's an existingoader context first.

  Searched for 3 patterns, read 2 fil

There's something important in the y does structuredClone beforepassing to renameIds. Let me read that section more carefully and then write the final
implementation.

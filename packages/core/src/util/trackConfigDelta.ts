/**
 * Track-config override deltas.
 *
 * A non-admin's track-menu / Settings edits are stored as a *delta* against the
 * admin-owned base config (jbrowse.tracks entry), not as a full copy. The delta
 * records only the slots the user changed; everything else resolves from the
 * live base, so a later admin change to an untouched field (e.g. a corrected
 * adapter URL) still flows through instead of being masked by a pinned full
 * snapshot.
 *
 * Two operations, inverse of each other on the realistic edit path:
 *   - `diffTrackConfig(base, edited)` — the minimal delta
 *   - `mergeTrackConfig(base, delta)` — reconstruct the effective config
 *
 * Deliberate limitation (no tombstones): a delta records adds/changes only, not
 * deletions. If a user *resets* a slot the admin had customized (base has it,
 * edited omits it), the delta can't express "drop below the admin value", so the
 * field keeps following the base. This keeps the merge trivial and the shared
 * JSON free of deletion sentinels; the case (reset a slot the admin explicitly
 * set) is rare, and following the admin value is a defensible outcome.
 *
 * `displays` is merged by `displayId` so an edit to one display doesn't pin the
 * others. Nested config objects (e.g. `adapter`) recurse. Any other array (value
 * arrays like `jexlFilters`, `assemblyNames`) is replaced wholesale when changed.
 *
 * Subtlety worth not "optimizing": when the base has NO `displays` array but the
 * edited snapshot does (common — a track config that omits displays gets a stub
 * per compatible display type injected by `baseTrackConfig.preProcessSnapshot`
 * when it hydrates), the whole edited array lands in the delta, including
 * seemingly content-free `{type, displayId}` stubs. Do not strip those stubs to
 * shrink the delta: the array order defines the default display (`displays[0]`),
 * and re-injection on the next hydrate would append them in a different order,
 * silently changing which display opens by default.
 */

type Json =
  | string
  | number
  | boolean
  | null
  | undefined
  | Json[]
  | { [key: string]: Json }

type JsonObject = Record<string, Json>

function isPlainObject(v: Json): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// An array is display-shaped (merge by identity) when every element is an object
// carrying a displayId. Anything else is a value array (replace-on-change).
function isDisplayArray(v: Json): v is JsonObject[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(e => isPlainObject(e) && typeof e.displayId === 'string')
  )
}

function deepEqual(a: Json, b: Json): boolean {
  if (a === b) {
    return true
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a)
    const bk = Object.keys(b)
    return (
      ak.length === bk.length && ak.every(k => k in b && deepEqual(a[k], b[k]))
    )
  }
  return false
}

// Sentinel returned by diffValue when a value is unchanged, so callers can tell
// "no delta" apart from a legitimate `undefined` slot value.
const UNCHANGED = Symbol('unchanged')

function diffValue(base: Json, edited: Json): Json | typeof UNCHANGED {
  if (deepEqual(base, edited)) {
    return UNCHANGED
  }
  if (isDisplayArray(edited) && isDisplayArray(base)) {
    const baseById = new Map(base.map(d => [d.displayId as string, d]))
    const out: JsonObject[] = []
    for (const editedDisplay of edited) {
      const id = editedDisplay.displayId as string
      const baseDisplay = baseById.get(id)
      if (baseDisplay) {
        const d = diffValue(baseDisplay, editedDisplay)
        if (d !== UNCHANGED) {
          // always re-key the delta entry by displayId so merge can realign it
          out.push({ ...(d as JsonObject), displayId: id })
        }
      } else {
        // a display present only in the edited config (e.g. an added display):
        // carry it whole
        out.push(editedDisplay)
      }
    }
    return out.length > 0 ? out : UNCHANGED
  }
  if (isPlainObject(edited) && isPlainObject(base)) {
    const out: JsonObject = {}
    for (const [k, v] of Object.entries(edited)) {
      const d = diffValue(base[k], v)
      if (d !== UNCHANGED) {
        out[k] = d
      }
    }
    // an object whose only difference from base is dropped keys (a reset the
    // delta can't express, see module note) yields no adds/changes: treat it as
    // unchanged rather than emitting a content-free entry
    return Object.keys(out).length > 0 ? out : UNCHANGED
  }
  // scalar, or an object/array replacing a scalar (or a value array): replace
  return edited
}

/**
 * Minimal delta of `edited` against `base`. Both are plain config snapshots
 * (post-stripDefault). Records adds/changes only; see the module note on the
 * no-tombstone limitation. Always retains `trackId` so the delta is
 * self-identifying.
 */
export function diffTrackConfig(
  base: Record<string, unknown>,
  edited: Record<string, unknown>,
): Record<string, unknown> {
  const d = diffValue(base as JsonObject, edited as JsonObject)
  const delta = d === UNCHANGED ? {} : (d as JsonObject)
  const trackId = (edited.trackId ?? base.trackId) as Json
  return { ...delta, trackId }
}

function mergeValue(base: Json, delta: Json): Json {
  if (isDisplayArray(delta) && isDisplayArray(base)) {
    const deltaById = new Map(delta.map(d => [d.displayId as string, d]))
    const merged = base.map(baseDisplay => {
      const d = deltaById.get(baseDisplay.displayId as string)
      return d ? (mergeValue(baseDisplay, d) as JsonObject) : baseDisplay
    })
    // displays present only in the delta (added by the user) append after base
    const baseIds = new Set(base.map(d => d.displayId as string))
    for (const d of delta) {
      if (!baseIds.has(d.displayId as string)) {
        merged.push(d)
      }
    }
    return merged
  }
  if (isPlainObject(delta) && isPlainObject(base)) {
    const out: JsonObject = { ...base }
    for (const [k, v] of Object.entries(delta)) {
      out[k] = mergeValue(base[k], v)
    }
    return out
  }
  // scalar / value array / type mismatch: delta wins
  return delta
}

/**
 * Reconstruct the effective config by layering `delta` over the live `base`.
 * Inverse of `diffTrackConfig` on the add/change path (see module note).
 */
export function mergeTrackConfig(
  base: Record<string, unknown>,
  delta: Record<string, unknown>,
): Record<string, unknown> {
  return mergeValue(base as JsonObject, delta as JsonObject) as JsonObject
}

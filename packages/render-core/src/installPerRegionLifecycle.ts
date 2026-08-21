import { computed, observable } from 'mobx'

// This ESM package builds without @types/node, but consuming bundlers
// (webpack/vite) still string-replace `process.env.NODE_ENV`, so keep the
// reference and give it a minimal module-scoped type for tsc.
declare const process: { env: { NODE_ENV?: string } }

import { createRegionUploadSync } from './regionUploadSync.ts'

import type { LifecycleHost } from './RenderLifecycleMixin.ts'
import type { ObservableMap } from 'mobx'

/**
 * The volatile a display keys its per-region worker payloads by
 * (`displayedRegionIndex` → result). Every one of them in tree is built with
 * this, so "how is per-region data represented" has one answer — see
 * ADR-060.
 *
 * **Shallow, and that follows from an invariant the codebase already states**:
 * per-region values are freshly constructed and never mutated (agent-docs
 * CLAUDE.md; backends diff by reference identity). Nothing inside an entry can
 * therefore change, so the deep enhancer's field-level atoms can never fire —
 * they are unreachable reactivity, not a safety margin. What they do cost is
 * paid on every insert and every read:
 *
 * - **Insert.** `deepEnhancer` recursively rebuilds each payload as an
 *   observable object graph — the stored value is not the object the worker
 *   produced. A multi-wiggle region is one atom per field per source, so a
 *   thousand-sample track pays ~18k on every pan; MAF pays the whole set again
 *   for every cached region on every row reorder, since `placeFetchedRows`
 *   re-places them all.
 * - **Read.** Each field access goes through `getObservablePropValue_`. Hot
 *   loops that hoist their typed arrays are fine, but the ones that don't were
 *   paying it per iteration.
 *
 * Typed arrays and class instances (Flatbush) pass through the deep enhancer
 * untouched, so the arrays were never the cost — the objects holding them were.
 *
 * Coarser tracking is the only behavioral difference, and it is unobservable
 * here: an entry is only ever replaced whole, so the keys atom and the entry's
 * own atom fire on exactly the same `.set`/`.delete`/`.clear`.
 *
 * Not for maps of primitives (`groupMaxHeightOverrides`,
 * `detectedModifications`), where the enhancer is a no-op, nor for UI state
 * whose values are mutated in place.
 *
 * **Dev-only, every entry is checked on the way in.** A fetch RPC answers a
 * payload or a `regionTooLarge` refusal, and every reader of this map is
 * written for the payload — so a value that is not one is a fetch that did not
 * happen, stored as though it had. There is no type to catch it: `onResult`
 * receives whatever the RPC resolved, typed as the payload it was supposed to
 * be, and the mock in the display harness resolved `undefined` for every
 * un-stubbed method for as long as the harness existed. Six reactions across
 * four packages then threw `Cannot read properties of undefined` on every run,
 * inside autoruns MobX catches and logs — invisible until the reaction gate
 * went in.
 *
 * Checked HERE because this is the one constructor all of them share, so the
 * store is one place while the readers are hundreds, and because a payload
 * caught at the `set` names the region and the display instead of surfacing as
 * a TypeError in whichever getter happened to read it first.
 */
export function regionDataMap<T>(
  // the field this map is stored on, so a violation names the map rather than
  // the eighteen that share this constructor
  name = 'region data',
): ObservableMap<number, T> {
  const map = observable.map<number, T>(undefined, { deep: false })
  if (process.env.NODE_ENV !== 'production') {
    const set = map.set.bind(map)
    map.set = (key: number, value: T) => {
      if (typeof value !== 'object' || value === null) {
        // `console.error`, never `throw`: this runs inside the fetch's own
        // result handler, where a throw is caught and reported as a failed
        // region — which would hide the violation being reported.
        console.error(
          `[jbrowse display contract] ${name}: region ${key} stored \`${value === null ? 'null' : typeof value}\`, ` +
            'not a payload. A fetch RPC answers a payload or a regionTooLarge ' +
            'refusal; storing anything else leaves every reader of this map ' +
            'reading through it.',
        )
      }
      return set(key, value)
    }
  }
  return map
}

interface UploadableRenderingBackend<Encoded> {
  uploadRegion(displayedRegionIndex: number, encoded: Encoded): void
  pruneRegions(active: Iterable<number>): void
}

/**
 * Render callback signature for per-region lifecycles. The second argument
 * is the latest encoded-output map kept by the helper — wiggle reads from
 * it because its renderer is stateless and needs the encoded form per
 * frame; plugins whose renderer reads `rpcDataMap` directly (manhattan,
 * MAF, variants) ignore the second argument. Return `true` if anything was
 * drawn (flips `canvasDrawn` — see RenderLifecycle).
 */
export type PerRegionRender<B, Encoded> = (
  backend: B,
  encoded: ReadonlyMap<number, Encoded>,
) => boolean

export interface PerRegionUpload<Data, Props, Encoded, B> {
  /**
   * The display's per-region payloads, keyed by `displayedRegionIndex` — an
   * `rpcDataMap` built with {@link regionDataMap}, or the whole-map computed a
   * cross-region layout produces (canvas's `renderDataMap`, the variant
   * display's `perRegionCellMap`). Read inside the upload autorun, so a
   * recompute re-runs the diff.
   */
  data: () => ReadonlyMap<number, Data>
  /**
   * Everything `encode` needs beyond the region's own data, as one value.
   * Omit it for an encode that needs nothing (an identity encode).
   *
   * **The helper memoizes this and re-encodes on its identity**, so it decides
   * how often every loaded region is rebuilt. Return the narrow thing —
   * wiggle's and MAF's `gpuProps()`, multi-row features' `featurePaintInputs`
   * — never the display's `renderState`, which carries the canvas box and the
   * row geometry: none of that is encoded (the shader takes it as uniforms)
   * and all of it moves on every frame of a height drag or a window resize.
   */
  inputs?: () => Props
  /**
   * Build one region's upload payload. Pure in `(data, props)`: reading an
   * observable directly here still works, but it does not invalidate anything
   * — only `data` and `inputs` do. Return `undefined` to skip this region for
   * now, keeping any payload it already has; the run re-fires once whatever
   * `inputs` reads changes.
   *
   * **Omit it when the payload the display holds is the payload the backend
   * takes.** Four of the seven per-region displays are in that shape, and each
   * wrote `encode: data => data` and then ignored `render`'s second argument,
   * reading its own map instead. Omitting is not the same code with a default
   * filled in: the helper skips the encode step entirely, so the two mirror maps
   * it keeps — one payload reference and one source reference per loaded region
   * — are never allocated, and `render` receives the display's own map.
   */
  encode?: (data: Data, props: Props) => Encoded | undefined
  render: PerRegionRender<B, Encoded>
}

/**
 * Per-region streamed upload for a display whose data is keyed by
 * `displayedRegionIndex` and whose regions encode independently.
 *
 * One upload autorun over the whole map, with two reference diffs under it:
 * a region re-encodes when its own entry is replaced or when `inputs` changes,
 * and re-uploads when its encoded payload changes — {@link createRegionUploadSync},
 * the same diff every other per-region upload in the tree runs on. A region
 * arrival costs one upload and one encode no matter how many regions are
 * loaded; an `inputs` change costs N of each, which is what it means.
 *
 * **`encode`'s reads no longer decide anything, and that is the point.** They
 * are still tracked — they run inside the upload autorun — so a wide read
 * re-runs the *diff*, which finds nothing changed and encodes nothing. The
 * failure that shape used to cause (a `renderState` read rebuilding tens of MB
 * of byte-identical buffer on every frame of a resize) needs `inputs` to be
 * wrong now, where it is one declaration per display rather than a property of
 * a closure. See render-core/CLAUDE.md.
 *
 * `render` owns the per-frame draw call and returns whether anything was
 * actually drawn (gates the `canvasDrawn` flag — see RenderingBackendCallbacks).
 * It receives the encoded map so a stateless renderer (wiggle) can draw from it
 * without re-encoding; renderers that read `rpcDataMap` directly ignore it.
 *
 * **Calling again only swaps the backend.** Displays wire this from
 * `startRenderingBackend`, which fires on every context-loss recovery, and the
 * diff and the encode cache live in the setup thunk so they survive one rather
 * than being rebuilt and dropped. Recovery re-uploads every region into a
 * backend the diff has not seen, without re-encoding — the payloads are still
 * good and only the GPU buffers are gone. What a second call cannot do is
 * *change* an `encode` or a `render`.
 *
 * @see installPerRegionLifecycle.test.ts — pins the upload and encode counts
 * this helper exists for.
 * @see ADR-078 — why this is one autorun and a diff rather than ADR-017's
 * autorun per key.
 */
// The identity overload, so omitting `encode` is a type error unless the
// display's own payload is what the backend uploads. Without it `Encoded` would
// be inferred as `unknown` and every `render` would take an unusable map.
export function installPerRegionLifecycle<
  Data,
  B extends UploadableRenderingBackend<Data>,
>(
  self: LifecycleHost,
  backend: B,
  opts: {
    data: () => ReadonlyMap<number, Data>
    render: PerRegionRender<B, Data>
    // `never`, so a call that DOES encode falls through to the overload below
    // rather than being matched here and reported against the wrong signature
    encode?: never
    inputs?: never
  },
): void
export function installPerRegionLifecycle<
  Data,
  Props,
  Encoded,
  B extends UploadableRenderingBackend<Encoded>,
>(
  self: LifecycleHost,
  backend: B,
  opts: PerRegionUpload<Data, Props, Encoded, B>,
): void
export function installPerRegionLifecycle<
  Data,
  Props,
  Encoded,
  B extends UploadableRenderingBackend<Encoded>,
>(
  self: LifecycleHost,
  backend: B,
  { data, inputs, encode, render }: PerRegionUpload<Data, Props, Encoded, B>,
) {
  self.attachRenderingBackend<B>(backend, () => {
    if (!encode) {
      // No encode step and so no mirror maps: the display's own map is what the
      // diff compares and what `render` is handed.
      const syncIdentity = createRegionUploadSync<Encoded, B>()
      return {
        upload: b => {
          syncIdentity(b, data() as unknown as ReadonlyMap<number, Encoded>)
        },
        render: b =>
          render(b, data() as unknown as ReadonlyMap<number, Encoded>),
      }
    }
    const encoded = new Map<number, Encoded>()
    const encodedFrom = new Map<number, Data>()
    const syncRegions = createRegionUploadSync<Encoded, B>()
    // A computed, not a plain call: `inputs` is free to build a fresh object
    // (`gpuProps()` does), and the identity of that object is what re-encodes
    // every region. Memoized, it changes when what `inputs` reads changes,
    // which is the invalidation the display means.
    const props = inputs && computed(inputs)
    let lastProps: Props | undefined

    return {
      upload: b => {
        const regions = data()
        const p = props ? props.get() : (undefined as Props)
        if (p !== lastProps) {
          lastProps = p
          encodedFrom.clear()
        }
        for (const [key, regionData] of regions) {
          if (encodedFrom.get(key) !== regionData) {
            const payload = encode(regionData, p)
            if (payload !== undefined) {
              encoded.set(key, payload)
              encodedFrom.set(key, regionData)
            }
          }
        }
        for (const key of encoded.keys()) {
          if (!regions.has(key)) {
            encoded.delete(key)
            encodedFrom.delete(key)
          }
        }
        syncRegions(b, encoded)
      },
      render: b => render(b, encoded),
    }
  })
}

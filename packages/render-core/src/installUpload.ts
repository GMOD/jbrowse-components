import { getType } from '@jbrowse/mobx-state-tree'
import { computed } from 'mobx'

import {
  contractReportsOn,
  reportContractViolation,
} from './contractReports.ts'
import { createMapUploadSync } from './mapUploadSync.ts'
import { isCheckedAtTheStore } from './regionDataMap.ts'

import type { LifecycleHost } from './RenderLifecycleMixin.ts'

/**
 * What every backend that takes keyed uploads implements. One cell is one
 * immutable payload under one key, and the key is whatever the display's own
 * map is keyed by: a `displayedRegionIndex`, a sibling display's
 * `sharedBackendKey`, or a slot name on a display that holds one payload.
 *
 * `release` is per key, never an active-set prune. The diff below knows
 * exactly which keys departed, so a per-key release does the same job on a
 * display's own map and is the only correct shape on a canvas several displays
 * share, where a prune computed from one display's map would wipe its
 * siblings' buffers.
 */
export interface CellTarget<K, Encoded> {
  upload(key: K, data: Encoded): void
  release(key: K): void
}

/**
 * What the backend takes, read off the backend, which is the direction the
 * overloads have to check in: the payload reaching `upload` must be assignable
 * to the parameter it declares. Inferring the other way, from `encode`'s
 * return, loses to the contravariant `backend` position and no encoding
 * display resolves an overload.
 */
type EncodedOf<B> = B extends { upload(key: never, data: infer E): void }
  ? E
  : never

export interface UploadSpec<K, Data, Props, Encoded, B> {
  /**
   * The display's payloads, one per key. Read inside the upload autorun, so a
   * commit re-runs the diff and only the entries whose reference moved reach
   * the backend. Absence is absence: a display with nothing to upload yet
   * leaves the key out rather than storing `undefined` under it, and the
   * departed key is released.
   */
  cells: () => ReadonlyMap<K, Data>
  /**
   * Everything `encode` needs beyond the cell's own data, as one value. The
   * helper memoizes it and re-encodes every cell on its identity, so return
   * the narrow thing a re-encode is actually about, never the whole render
   * state.
   */
  inputs?: () => Props
  /**
   * Build one cell's upload payload. Pure in `(data, props, key)`: an
   * observable read here is tracked but invalidates nothing, only `cells` and
   * `inputs` do. The key is for a display whose cells are not all the same
   * kind of thing, a contact matrix beside the palette it is drawn through.
   */
  encode?: (data: Data, props: Props, key: K) => Encoded
  /**
   * Draw one frame from the latest encoded map and say whether real content
   * reached the canvas.
   */
  render: (backend: B, encoded: ReadonlyMap<K, Encoded>) => boolean
}

/**
 * The cells of a display that holds one payload for the whole view: the key
 * while the payload is there, nothing while it is not. Absence is how such a
 * display says "nothing to upload yet", so the diff releases the key rather
 * than being handed `undefined` under it.
 */
export function oneCell<K, T>(
  key: K,
  value: T | undefined | null,
): ReadonlyMap<K, T> {
  const cells = new Map<K, T>()
  if (value !== undefined && value !== null) {
    cells.set(key, value)
  }
  return cells
}

const alreadyNamed = new WeakMap<LifecycleHost, Set<unknown>>()

function checkPayloads(
  self: LifecycleHost,
  cells: ReadonlyMap<unknown, unknown>,
) {
  if (isCheckedAtTheStore(cells)) {
    return
  }
  for (const [key, value] of cells) {
    if (value === undefined || value === null) {
      let named = alreadyNamed.get(self)
      if (!named) {
        named = new Set()
        alreadyNamed.set(self, named)
      }
      if (!named.has(key)) {
        named.add(key)
        reportContractViolation(
          'display',
          `${getType(self).name}: cell ${String(key)} ` +
            `handed to installUpload is \`${String(value)}\`. A fetch answers ` +
            'a payload or nothing; leave the key out until it has one.',
        )
      }
    }
  }
}

/**
 * The one upload lifecycle. A display hands over a map of immutable payloads
 * and a render; the helper diffs the map by reference on every commit,
 * encodes and uploads what moved, releases what left, and re-uploads
 * everything into a fresh backend after a context loss.
 *
 * Per-region, shared-canvas and whole-view displays were three installers
 * over this one diff, split by how a departed key was released and by the
 * name of the backend's upload method. With `CellTarget` naming both, what is
 * left per family is the key the display's map is keyed by.
 *
 * **Calling again only swaps the backend.** Displays wire this from
 * `startRenderingBackend`, which fires again on every context-loss recovery;
 * the diff and the encode cache live in the setup thunk and survive it.
 *
 * @see installUpload.test.ts for the upload, encode and release counts.
 * @see ADR-078 for why this is one autorun and a diff.
 */
export function installUpload<
  K,
  Data extends EncodedOf<B>,
  B extends CellTarget<K, unknown>,
>(
  self: LifecycleHost,
  backend: B,
  spec: {
    cells: () => ReadonlyMap<K, Data>
    render: (backend: B, encoded: ReadonlyMap<K, Data>) => boolean
    encode?: never
    inputs?: never
  },
): void
export function installUpload<K, Data, Props, B extends CellTarget<K, unknown>>(
  self: LifecycleHost,
  backend: B,
  spec: UploadSpec<K, Data, Props, EncodedOf<B>, B> & {
    encode: (data: Data, props: Props, key: K) => EncodedOf<B>
  },
): void
export function installUpload<
  K,
  Data,
  Props,
  Encoded,
  B extends CellTarget<K, Encoded>,
>(
  self: LifecycleHost,
  backend: B,
  { cells, inputs, encode, render }: UploadSpec<K, Data, Props, Encoded, B>,
) {
  self.attachRenderingBackend<B>(backend, () => {
    const sync = createMapUploadSync<K, Encoded, B>({
      upload: (b, key, data) => {
        b.upload(key, data)
      },
      remove: (b, key) => {
        b.release(key)
      },
    })
    if (!encode) {
      const own = cells as unknown as () => ReadonlyMap<K, Encoded>
      return {
        upload: b => {
          const current = own()
          if (contractReportsOn()) {
            checkPayloads(self, current)
          }
          return sync(b, current)
        },
        render: b => render(b, own()),
      }
    }
    const encoded = new Map<K, Encoded>()
    const encodedFrom = new Map<K, Data>()
    const props = inputs && computed(inputs)
    let lastProps: Props | undefined
    return {
      upload: b => {
        const current = cells()
        if (contractReportsOn()) {
          checkPayloads(self, current)
        }
        const p = props ? props.get() : (undefined as Props)
        if (p !== lastProps) {
          lastProps = p
          encodedFrom.clear()
        }
        for (const [key, data] of current) {
          if (encodedFrom.get(key) !== data) {
            encoded.set(key, encode(data, p, key))
            encodedFrom.set(key, data)
          }
        }
        for (const key of encoded.keys()) {
          if (!current.has(key)) {
            encoded.delete(key)
            encodedFrom.delete(key)
          }
        }
        return sync(b, encoded)
      },
      render: b => render(b, encoded),
    }
  })
}

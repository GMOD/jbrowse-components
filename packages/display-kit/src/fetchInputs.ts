import { compareStructural, computed } from 'mobx'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The two tiers of a per-region fetch's inputs, as **values** rather than as
 * the strings `regionFetchKey` / `settingsFetchKey` spell. `compareStructural`
 * decides them, so a display states each input once — in the object it sends
 * the worker — instead of once there and once again in a key.
 *
 * Two tiers and not one, because the tiers differ in what a change *shows*:
 * `settings` raises `staleSettingsDrawn`'s scrim over the held data, `zoom`
 * deliberately does not. Everything else about them is the same question.
 */
export interface FetchInputs {
  settings: unknown
  zoom: unknown
}

/**
 * The host members {@link makeFetchInputs} reads. All three are looked up
 * dynamically rather than declared on the mixin's public interface, so a
 * subclass keeps its narrow `rpcProps()` return type through MST's `.views()`
 * chain.
 */
export interface FetchInputsHost extends IStateTreeNode {
  rpcProps?: () => unknown
  adapterConfig?: Record<string, unknown>
  /**
   * The zoom-derived worker arguments as an object — **the same object the
   * display spreads into its RPC call**, which is the whole point of the hook:
   * a display that sends `bpPerPx` and keys on `String(bpPerPx)` has written
   * one fact twice, and the two spellings drift (canvas keys a peptide
   * threshold while it sends a glyph mode; alignments keys a bin and a tier and
   * compares the same two again in `dataSuperseded`).
   *
   * A display that has not been converted leaves this undefined and its
   * `zoomFetchKey` string is the zoom tier instead.
   */
  zoomFetchArgs?: () => object
  zoomFetchKey: string
}

/**
 * `settings` and `zoom` as two structural computeds on one display.
 *
 * Structural, so the value's identity survives a recomputation that lands on
 * the same content — every region a fetch stamps holds the *same* object, and
 * `isCacheValid`'s compare then short-circuits on `===`. That is what makes a
 * deep compare per visible block cheaper than the string compare it replaces:
 * the string had to be built and walked on every settings read.
 *
 * Structural also settles two hazards the JSON key could not. `JSON.stringify`
 * drops an `undefined`-valued key, so a field could not be told from a sibling
 * state that also drops; and it flattens a class with no own enumerable fields
 * to `{}`. `compareStructural` counts keys and compares own fields, so neither
 * state is silently dead.
 */
export function makeFetchInputs(self: FetchInputsHost) {
  const settings = computed(
    () => ({
      rpcProps: self.rpcProps?.call(self),
      adapterConfig: self.adapterConfig,
    }),
    { equals: compareStructural },
  )
  const zoom = computed(
    () => self.zoomFetchArgs?.call(self) ?? self.zoomFetchKey,
    {
      equals: compareStructural,
    },
  )
  const inputs = computed(
    (): FetchInputs => ({ settings: settings.get(), zoom: zoom.get() }),
    { equals: compareStructural },
  )
  return { settings, zoom, inputs }
}

/**
 * Whether a region's stamp still answers the current inputs. Identity first,
 * which is the case that runs on every autorun pass over an unchanged display.
 */
export function fetchInputsCurrent(
  stamped: FetchInputs | undefined,
  current: FetchInputs,
) {
  return stamped !== undefined && compareStructural(stamped, current)
}

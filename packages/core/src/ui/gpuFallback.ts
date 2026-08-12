import {
  isGpuRenderingDisabled,
  setGpuOverride,
} from '@jbrowse/render-core/gpuDevice'
import { isGpuContextLostError } from '@jbrowse/render-core/useRenderingBackend'

/**
 * The page-wide escape from a lost GPU context, as the three things every
 * presentation of it needs. React-free on purpose: the MUI banners take
 * {@link default as GpuFallbackButton} next door, but the plain-chrome overlays
 * an embedder gets are deliberately MUI-free and render their own `<button>`,
 * so the only thing all of them can share is this.
 *
 * Sharing it is not tidiness. The tooltip below was already written out twice,
 * word for word, in the two overlays that offered the button — and the ones that
 * did not offer it at all (dotplot, synteny) were the actual bug: a lost context
 * is page-wide, so those views are the *victims* of a budget some other view
 * spent, and they were the ones left with no way out.
 */
export const GPU_FALLBACK_LABEL = 'Use Canvas2D'

export const GPU_FALLBACK_TOOLTIP =
  'Stop using the GPU for the rest of this session and draw with Canvas2D instead. Slower on dense data, but unaffected by how many views are open.'

/**
 * Whether this error is one switching to Canvas2D would actually fix, and the
 * GPU is still on. Both halves matter: an over-allocation error's remedy is to
 * zoom in rather than to change backend, and once the GPU is off the button is a
 * no-op that only invites a second click.
 *
 * **Pass the GPU error itself, not a combined one.** The flag lives on the error
 * object, so anything that has flattened errors into a string — synteny's level
 * banner joins the GPU error with each display's fetch error for display —
 * answers `false` here and silently drops the button.
 */
export function shouldOfferGpuFallback(error: unknown) {
  return isGpuContextLostError(error) && !isGpuRenderingDisabled()
}

/**
 * Turn the GPU off for the rest of the page. The same switch `?renderer=canvas2d`
 * throws, so every backend built afterwards is the Canvas2D one; the caller
 * still has to retry the display it is showing this from.
 */
export function disableGpuRendering() {
  setGpuOverride('canvas2d')
}

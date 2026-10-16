import type { ComponentType } from 'react'

/** What `RenderError` draws: a render-backend failure and the re-init. */
export interface RenderErrorProps {
  error: unknown
  onRetry: () => void
  height: number
}

/**
 * What `TooLarge` draws: the byte gate's banner text and the way past it.
 * `onForceLoad` is the whole point of the state; without it the region is
 * unreachable for the rest of the session.
 */
export interface TooLargeProps {
  message: string
  onForceLoad: () => void
}

/**
 * What `ErrorBar` draws: a failed fetch. No `onRetry` means a Retry cannot
 * clear it (the byte gate tripped inside the fetch), so draw the message as
 * information.
 */
export interface ErrorBarProps {
  error: unknown
  onRetry?: () => void
}

/**
 * What `Loading` draws. A display that reports no progress and offers no cancel
 * passes neither, and still gets a scrim. `canceled` swaps Cancel for Retry.
 */
export interface LoadingProps {
  visible: boolean
  immediate?: boolean
  message?: string
  progress?: number
  canceled?: boolean
  onCancel?: () => void
  onRetry?: () => void
}

/** What `BackgroundProgress` draws: work with no fetch behind it. */
export interface BackgroundProgressProps {
  message?: string
  progress?: number
}

/**
 * The five components that draw `displayPhase`'s terminal and overlay states.
 * `DisplayChromeBase` decides which renders, reads the display model, and hands
 * each plain values and callbacks, so a set needs no model, no MobX and no UI
 * toolkit: an embedder with their own design system supplies plain markup and
 * ships no ThemeProvider. Every import above is type-only, so this module pulls
 * no runtime dependency.
 *
 * A replacement set must render something for each state; four test systems
 * key on the testids in `plainChromeOverlays.tsx`.
 *
 * `ErrorBar`, `Loading` and `BackgroundProgress` are portalled as a group into
 * the LGV's per-track overlay layer, which is `pointer-events: none`, so
 * anything of yours the user clicks sets `pointer-events: auto` on its own
 * positioned box. `BackgroundProgress` alone does not own its box; see its
 * entry.
 */
export interface DisplayChromeOverlays {
  /**
   * GPU/render-backend failure. A subtree-replacing terminal state: the canvas
   * unmounts and the backend disposes, so this owns the full display area.
   */
  RenderError: ComponentType<RenderErrorProps>
  /** The byte gate tripped. Also subtree-replacing. */
  TooLarge: ComponentType<TooLargeProps>
  /**
   * Fetch error, drawn *over* a live canvas rather than replacing it. Mounted
   * only while the phase is `error`.
   */
  ErrorBar: ComponentType<ErrorBarProps>
  /**
   * The loading scrim, `visible` in the `loading` and `canceled` phases;
   * `immediate` asks it to skip any anti-flash delay because nothing is painted
   * yet.
   *
   * Mounted unconditionally, so it handles `visible === false` itself. An
   * anti-flash delay is component state, so a chrome that mounted this only
   * while loading would restart the timer on every activation and never reach
   * it. Keep any replacement mountable-while-hidden for the same reason.
   */
  Loading: ComponentType<LoadingProps>
  /**
   * Status for work with no fetch behind it, mounted only while that work
   * runs: in the LGV chrome, a status message set while the phase is `ready`.
   *
   * **The one state that does not own its own box.** The chrome anchors the
   * bottom-right corner and lays this out there, sharing it with the display's
   * own control row (`BottomRightIndicators`). So render an **in-flow** chip:
   * no `position`, no `inset`, no corner offsets. Sizing and colors are yours;
   * placement is not. See `bottomRightCorner.ts`.
   */
  BackgroundProgress: ComponentType<BackgroundProgressProps>
}

// the subpath, not the `@jbrowse/core/ui` barrel: this file is the MUI-free
// chrome, and gpuFallback.ts is React-free for exactly that reason
import {
  GPU_FALLBACK_LABEL,
  GPU_FALLBACK_TOOLTIP,
  disableGpuRendering,
  shouldOfferGpuFallback,
} from '@jbrowse/core/ui/gpuFallback'
import { progressLabel } from '@jbrowse/core/util/progress'
import { observer } from 'mobx-react'

import { isLiveModel } from './isLiveModel.ts'
import { tooLargeBannerText } from './tooLargeBannerText.ts'

import type {
  DisplayBackgroundProgressModel,
  DisplayChromeOverlays,
  DisplayErrorBarModel,
  DisplayLoadingOverlayModel,
  TooLargeMessageModel,
} from './chromeOverlays.ts'

// A dependency-free `DisplayChromeOverlays` for embedders who don't want MUI:
// no theme provider to mount, no emotion injected into the host page, and
// nothing that reads as a stray Material widget inside someone else's design
// system. Pair it with `DisplayChromeBase` (NOT `DisplayChrome`, which binds
// the MUI set and would defeat the point by keeping MUI in the module graph).
//
// Deliberately plain rather than pretty: every rule below is either layout that
// the chrome's contract requires, or a hairline so the state is legible against
// an unknown background. Colors come from `currentColor` and `color-mix` so the
// host's own cascade drives them. Restyle by wrapping these, or write your own
// set against the same interface.
//
// The testids are NOT cosmetic. `loading-overlay`, `loading-overlay-cancel`,
// `loading-overlay-retry`, `progress-chip`, `reload_button` and
// `use_canvas2d_button` are a contract across four test systems (jest, browser
// tests, screenshot harness, jbrowse-img), so a replacement set that wants to
// run the existing suites has to keep them.

// The scrim and the too-large/error banners all need to sit over the canvas
// without eating pointer events; only the inner content is interactive. Matches
// the MUI set's behavior, where leaving an interactive box mounted over every
// track silently swallowed clicks.
const overlayBox: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  pointerEvents: 'none',
  zIndex: 1,
}

// Nearly opaque on purpose. These sit over a canvas whose colours are not known
// here, and a translucent chip over dense data was measurably hard to read.
// `Canvas`/`CanvasText` are the CSS system colours, so this tracks the host's
// light/dark mode without needing a theme object.
const chip: React.CSSProperties = {
  pointerEvents: 'auto',
  margin: 4,
  padding: '3px 8px',
  fontSize: '0.8rem',
  lineHeight: 1.4,
  color: 'CanvasText',
  border: '1px solid',
  borderColor: 'color-mix(in srgb, CanvasText 35%, transparent)',
  borderRadius: 4,
  background: 'color-mix(in srgb, Canvas 94%, transparent)',
}

const button: React.CSSProperties = {
  font: 'inherit',
  color: 'CanvasText',
  marginLeft: 8,
  padding: '0 6px',
  cursor: 'pointer',
  border: '1px solid',
  borderColor: 'color-mix(in srgb, CanvasText 45%, transparent)',
  borderRadius: 3,
  background: 'transparent',
}

// Terminal states replace the whole subtree, so unlike the overlays above they
// own the display box and are the only thing in it.
function banner(height?: number): React.CSSProperties {
  return {
    height,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 8,
    fontSize: '0.8rem',
    border: '1px solid',
    borderColor: 'color-mix(in srgb, currentColor 25%, transparent)',
  }
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

// Announcement, split across two elements on purpose.
//
// The chip carrying a status is a `role="status"` polite live region, so a
// screen reader reads the phase once when it changes ("Loading", "Clustering
// samples"). The percentage is deliberately NOT in that region: a determinate
// status ticks about ten times a second, and a live region carrying the number
// talks over everything else on the page until the fetch ends.
//
// The bar below is where the number goes. Screen readers do not announce
// `aria-valuenow` changes on a `progressbar`, so the value is reachable on
// demand and silent otherwise — which is the behaviour a progress indicator
// should have. `StatusProgressBar` in core does the same thing and is
// toolkit-free, but it paints `theme.palette.primary.main`; every rule in this
// file reads the host's own cascade instead, so the bar is drawn here rather
// than imported.
function ProgressBar({ fraction }: { fraction: number }) {
  const filled = Math.min(1, Math.max(0, fraction))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(filled * 100)}
      style={{
        overflow: 'hidden',
        width: 60,
        height: 3,
        marginLeft: 6,
        borderRadius: 2,
        background: 'color-mix(in srgb, currentColor 26%, transparent)',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'currentColor',
          // scaled rather than sized, so an update is a compositor transform
          transformOrigin: 'left center',
          transform: `scaleX(${filled})`,
          transition: 'transform 200ms linear',
        }}
      />
    </div>
  )
}

const PlainRenderError = observer(function PlainRenderError({
  error,
  onRetry,
  height,
}: {
  error: unknown
  onRetry: () => void
  height: number
}) {
  return (
    <div style={banner(height)} role="alert">
      <span style={{ wordBreak: 'break-word' }}>{errorText(error)}</span>
      <button
        type="button"
        style={button}
        data-testid="reload_button"
        onClick={onRetry}
      >
        Retry
      </button>
      {/* A lost GPU context is caused by the browser's cap of ~16 live WebGL
          contexts across every view, so retrying only helps if capacity has
          since freed. This is the remedy that always works, and the MUI set
          offers it too -- dropping it here would leave an embedder's users
          with a dead track and no way out. The predicate and the wording are
          shared with that set (`GpuFallbackButton`); only the markup differs,
          because this chrome cannot reach for MUI. */}
      {shouldOfferGpuFallback(error) ? (
        <button
          type="button"
          style={button}
          data-testid="use_canvas2d_button"
          title={GPU_FALLBACK_TOOLTIP}
          onClick={() => {
            disableGpuRendering()
            onRetry()
          }}
        >
          {GPU_FALLBACK_LABEL}
        </button>
      ) : null}
    </div>
  )
})

const PlainTooLarge = observer(function PlainTooLarge({
  model,
}: {
  model: TooLargeMessageModel
}) {
  return (
    <div style={banner()} role="status">
      <span style={{ wordBreak: 'break-word' }}>
        {tooLargeBannerText(model.regionTooLargeReason, {
          zoomCanRelease: model.zoomCanReleaseGate,
        })}
      </span>
      <button
        type="button"
        style={button}
        onClick={() => {
          // the banner unmounts the canvas, so a click landing after the track
          // was closed would otherwise call an action on a dead node. Not bare
          // `isAlive` — this model may be the plain object the contract invites,
          // which that throws on. See isLiveModel.ts.
          if (isLiveModel(model)) {
            model.forceLoad()
          }
        }}
      >
        Force load
      </button>
    </div>
  )
})

const PlainErrorBar = observer(function PlainErrorBar({
  model,
  visible,
}: {
  model: DisplayErrorBarModel
  visible: boolean
}) {
  return visible && model.error ? (
    <div style={overlayBox} role="alert">
      <div style={chip}>
        <span style={{ wordBreak: 'break-word' }}>
          {errorText(model.error)}
        </span>
        <button
          type="button"
          style={button}
          data-testid="reload_button"
          onClick={() => {
            model.reload()
          }}
        >
          Retry
        </button>
      </div>
    </div>
  ) : null
})

// No anti-flash delay here, unlike the MUI set: that timing is a product
// judgment JBrowse made for its own UI, and an embedder pacing their own
// loading affordances shouldn't inherit it invisibly. Wrap this if you want it.
const PlainLoading = observer(function PlainLoading({
  model,
  visible,
}: {
  model: DisplayLoadingOverlayModel
  visible: boolean
  immediate?: boolean
}) {
  if (!visible) {
    return null
  }
  const { statusMessage, statusProgress, fetchCanceled } = model
  return (
    <div style={overlayBox} data-testid="loading-overlay">
      <div
        style={{ ...chip, display: 'flex', alignItems: 'center' }}
        role="status"
      >
        {fetchCanceled ? (
          <>
            <span>Loading canceled</span>
            {model.reload ? (
              <button
                type="button"
                style={button}
                data-testid="loading-overlay-retry"
                onClick={() => {
                  model.reload?.()
                }}
              >
                Retry
              </button>
            ) : null}
          </>
        ) : (
          <>
            {/* `progressLabel` owns the `X%` suffix for the whole repo, so the
                two sets cannot round it differently. The ellipsis is this set's
                own indeterminate cue — the Material one animates LoadingDots
                there, and a static string is the plain equivalent. */}
            <span>
              {statusProgress === undefined
                ? `${statusMessage || 'Loading'}...`
                : progressLabel(statusMessage || 'Loading', statusProgress)}
            </span>
            {statusProgress === undefined ? null : (
              <ProgressBar fraction={statusProgress} />
            )}
            {model.cancelFetchByUser ? (
              <button
                type="button"
                style={button}
                data-testid="loading-overlay-cancel"
                onClick={() => {
                  model.cancelFetchByUser?.()
                }}
              >
                Cancel
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
})

const PlainBackgroundProgress = observer(function PlainBackgroundProgress({
  model,
  visible,
}: {
  model: DisplayBackgroundProgressModel
  visible: boolean
}) {
  // The only state that renders no positioned box of its own: the chrome
  // anchors the bottom-right corner and shares it with the display's control
  // row, so this is laid out there. Claiming `inset: 0` here would collapse
  // against that box, and pinning to the corner would sit under the row.
  return visible && model.statusMessage ? (
    <div
      style={{ ...chip, display: 'flex', alignItems: 'center' }}
      role="status"
      data-testid="progress-chip"
    >
      <span>{progressLabel(model.statusMessage, model.statusProgress)}</span>
      {model.statusProgress === undefined ? null : (
        <ProgressBar fraction={model.statusProgress} />
      )}
    </div>
  ) : null
})

/**
 * #api
 * The five `displayPhase` states drawn with no UI toolkit: no theme provider to
 * mount, no emotion in the host page, and nothing that reads as a stray Material
 * widget inside someone else's design system.
 *
 * `DisplayUIProvider` installs this by default, so mount that rather than
 * naming this — reach for it directly only to wrap a state or to build a
 * context value by hand. Colours come from `currentColor` and the CSS system
 * colours, so the host's own cascade drives them in both light and dark.
 *
 * The `data-testid` values it renders are a contract four of JBrowse's test
 * systems key on, so a replacement set that keeps them can be driven by those
 * suites too.
 */
const plainChromeOverlays: DisplayChromeOverlays = {
  RenderError: PlainRenderError,
  TooLarge: PlainTooLarge,
  ErrorBar: PlainErrorBar,
  Loading: PlainLoading,
  BackgroundProgress: PlainBackgroundProgress,
}

export default plainChromeOverlays

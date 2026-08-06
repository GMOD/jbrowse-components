// Reusable SVG-export building blocks, usable by any plugin without pulling in
// the linear-genome-view plugin. Non-component members live in sibling files
// (`constants.ts`, `svgReady.ts`) so this stays component-only for
// react-refresh.

import { useTheme } from '@mui/material'

import { stripAlpha } from '../util/index.ts'
import { exportMargin } from './constants.ts'
import { svgSafeId } from './svgId.ts'

// Full-bleed background rect. `width`/`height` are the *total* SVG dimensions.
export function SVGBackground({
  width,
  height,
}: {
  width: number
  height: number
}) {
  const theme = useTheme()
  return (
    <rect
      width={width}
      height={height}
      fill={stripAlpha(theme.palette.background.default)}
    />
  )
}

// Root <svg> for an image export. Owns the xmlns/viewBox boilerplate, widens
// the canvas by `margin` on each side, and paints the themed background.
// `width`/`height` are the content dimensions (the rendered canvas is
// `width + margin * 2` wide); views translate their content by `margin` to sit
// inside the gutter.
export function SVGExportRoot({
  width,
  height,
  margin = exportMargin,
  fontFamily,
  children,
}: {
  width: number
  height: number
  margin?: number
  // Font for the whole export, inherited by every <text> so raw-JSX labels
  // (ruler, scalebar, axes) and SvgCanvas feature labels stay consistent.
  // Empty/undefined emits no font-family, leaving the renderer default; a
  // generic family (sans-serif/serif/monospace) resolves in any SVG viewer
  // without embedding a named font.
  fontFamily?: string
  children: React.ReactNode
}) {
  const totalWidth = width + margin * 2
  return (
    <svg
      width={totalWidth}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox={`0 0 ${totalWidth} ${height}`}
      fontFamily={fontFamily ? fontFamily : undefined}
    >
      <SVGBackground width={totalWidth} height={height} />
      {children}
    </svg>
  )
}

export function SVGErrorBox({
  error,
  width,
  height,
}: {
  error: unknown
  width: number
  height: number
}) {
  return (
    <>
      <rect x={0} y={0} width={width} height={height} fill="#ffdddd" />
      <text x={10} y={height / 2} fill="#cc0000" fontSize={14}>
        {`${error}`}
      </text>
    </>
  )
}

// Neutral informational box for a soft terminal state (region too large): the
// calm counterpart to SVGErrorBox's red-alarm styling. Keeps the track's
// reserved height and labels a state that would otherwise export as a silent
// blank.
export function SVGMessageBox({
  message,
  width,
  height,
}: {
  message: string
  width: number
  height: number
}) {
  return (
    <>
      <rect x={0} y={0} width={width} height={height} fill="#f2f2f2" />
      <text x={10} y={height / 2} fill="#555555" fontSize={14}>
        {message}
      </text>
    </>
  )
}

// SVG-export counterpart of DisplayChrome (BaseLinearDisplay/components): the
// single terminal-state gate every display's `renderSvg` ends in. It renders the
// terminal state itself — a themed SVGErrorBox on error, a "region too large"
// message next — and only paints the children when the display has renderable
// data. The body is an ordinary child component, so it never runs in a terminal
// state and no `renderSvg` re-detects one from empty/absent data. The readiness
// wait stays an explicit `await awaitSvgReady(model)` in each `renderSvg` (the
// one genuinely async step), so this component is sync.
export function SvgChrome({
  error,
  regionTooLarge,
  width,
  height,
  children,
}: {
  error: unknown
  regionTooLarge?: boolean
  width: number
  height: number
  children: React.ReactNode
}) {
  return error ? (
    <SVGErrorBox error={error} width={width} height={height} />
  ) : regionTooLarge ? (
    <SVGMessageBox
      message="Region too large to render"
      width={width}
      height={height}
    />
  ) : (
    <>{children}</>
  )
}

export function SvgClipRect({
  id,
  x = 0,
  y = 0,
  width,
  height,
  children,
}: {
  // may contain config data (a trackId, a refName-bearing block key). Pass it
  // raw: sanitizing happens here, where the id and the `url()` pointing at it
  // are both emitted, and svgSafeId must not be applied twice
  id: string
  // Origin of the clip rect in the caller's own coordinate space. Defaults to
  // the origin, which is what a clip fitted to its group wants; a clip inset
  // into a box that starts elsewhere (SVGTracks, whose track body sits below a
  // label band and may bleed into a left gutter) sets them rather than
  // hand-rolling the <clipPath>, which meant hand-rolling svgSafeId too.
  x?: number
  y?: number
  width: number
  height: number
  children: React.ReactNode
}) {
  const safeId = svgSafeId(id)
  return (
    <>
      <defs>
        <clipPath id={safeId}>
          <rect x={x} y={y} width={width} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${safeId})`}>{children}</g>
    </>
  )
}

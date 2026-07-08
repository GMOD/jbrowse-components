// Reusable SVG-export building blocks, usable by any plugin without pulling in
// the linear-genome-view plugin. Non-component members live in sibling files
// (`constants.ts`, `svgReady.ts`) so this stays component-only for
// react-refresh.

import { useTheme } from '@mui/material'

import { exportMargin } from './constants.ts'
import { stripAlpha } from '../util/index.ts'

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

// SVG-export counterpart of DisplayChrome (BaseLinearDisplay/components): the
// shared terminal-state gate every display's `renderSvg` ends in — render a
// themed SVGErrorBox on error, otherwise the children. The display body is an
// ordinary child component, rendered (and thus painted) only in the non-error
// branch. The readiness wait stays an explicit `await awaitSvgReady(model)` in
// each `renderSvg` (the one genuinely async step), so this component is sync.
export function SvgChrome({
  error,
  width,
  height,
  children,
}: {
  error: unknown
  width: number
  height: number
  children: React.ReactNode
}) {
  return error ? (
    <SVGErrorBox error={error} width={width} height={height} />
  ) : (
    <>{children}</>
  )
}

export function SvgClipRect({
  id,
  width,
  height,
  children,
}: {
  id: string
  width: number
  height: number
  children: React.ReactNode
}) {
  return (
    <>
      <defs>
        <clipPath id={id}>
          <rect x={0} y={0} width={width} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>{children}</g>
    </>
  )
}

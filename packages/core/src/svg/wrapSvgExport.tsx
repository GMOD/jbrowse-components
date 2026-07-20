import { ThemeProvider } from '@mui/material'

import { createJBrowseTheme } from '../ui/theme.ts'
import { renderToStaticMarkup } from '../util/index.ts'
import { SVGExportRoot } from './SvgExport.tsx'

import type { ThemeOptions } from '@mui/material'

// Coordinates computed as bp/bpPerPx land in attributes as long floats
// (`-32.4816`) or floating-point noise (`242.23839999999998`), bloating exports
// with sub-pixel precision no renderer needs. Round numbers inside a fixed
// whitelist of numeric attributes, so a track label or id that happens to look
// numeric is never a candidate for rewriting. Geometry gets 2 decimals
// (sub-pixel); opacity keeps 3 so a faint 0.01 mark can't collapse to 0.
const COORD_ATTRS = [
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'dx',
  'dy',
  'width',
  'height',
  'd',
  'points',
  'transform',
  'gradientTransform',
  'offset',
  'viewBox',
  'font-size',
  'stroke-width',
  'stroke-dashoffset',
  'stroke-dasharray',
]
const OPACITY_ATTRS = [
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'stop-opacity',
  'flood-opacity',
]

function makeRounder(attrs: string[], digits: number) {
  const re = new RegExp(`\\b(${attrs.join('|')})="([^"]*)"`, 'g')
  return (svg: string) =>
    svg.replaceAll(re, (_, name: string, value: string) => {
      const rounded = value.replaceAll(/-?\d+\.\d{3,}(?:e-?\d+)?/gi, n =>
        String(Number.parseFloat(Number(n).toFixed(digits))),
      )
      return `${name}="${rounded}"`
    })
}

const roundCoords = makeRounder(COORD_ATTRS, 2)
const roundOpacity = makeRounder(OPACITY_ATTRS, 3)

function roundSvgNumbers(svg: string) {
  return roundOpacity(roundCoords(svg))
}

// The identical tail every view's `renderToSvg` ends in: resolve the export
// theme into a provider, apply the caller-supplied Wrapper, wrap the content in
// the root <svg>, and serialize to a markup string. Callers keep their own
// layout math and children — only this boilerplate lives here.
export function wrapSvgExport({
  theme,
  width,
  height,
  margin,
  fontFamily,
  Wrapper = ({ children }) => children,
  children,
}: {
  theme: ThemeOptions | undefined
  width: number
  height: number
  margin?: number
  fontFamily?: string
  Wrapper?: React.FC<{ children: React.ReactNode }>
  children: React.ReactNode
}) {
  return roundSvgNumbers(
    renderToStaticMarkup(
      <ThemeProvider theme={createJBrowseTheme(theme)}>
        <Wrapper>
          <SVGExportRoot
            width={width}
            height={height}
            margin={margin}
            fontFamily={fontFamily}
          >
            {children}
          </SVGExportRoot>
        </Wrapper>
      </ThemeProvider>,
    ),
  )
}

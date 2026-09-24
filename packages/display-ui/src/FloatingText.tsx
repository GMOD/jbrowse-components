import type { CSSProperties, ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * Four offset shadows in the surface colour: a halo under a line of DOM text
 * that needs no measured stroke and reads the same over a mark and over the
 * background.
 */
export function textHalo(color: string) {
  return `-1px -1px 0 ${color}, 1px -1px 0 ${color}, -1px 1px 0 ${color}, 1px 1px 0 ${color}`
}

/**
 * Where a line box's glyph baseline sits below its top, as a fraction of the
 * font size. A DOM label is positioned by its top and an exported `<text>` by
 * its baseline, and this is what puts the two on one line.
 */
export const TEXT_BASELINE_RATIO = 0.84

/**
 * One line of text floated over a display, at the px `x` and `y` of its line
 * box's top-left corner: absolutely positioned, one line high, never wrapped.
 * The canvas feature labels and the mark display's text marks emit through
 * this, so the typography of a floated label is one declaration; what places
 * each label is its display's own rule. `halo` draws {@link textHalo} under
 * the glyphs in that colour. Everything else a caller passes reaches the div:
 * a class for the pointer and the cursor, the data attributes a delegated
 * handler reads, a `title`.
 */
export function FloatingText({
  x,
  y,
  color,
  fontSize,
  halo,
  style,
  children,
  ...rest
}: {
  x: number
  y: number
  color: string
  fontSize: number
  halo?: string
  style?: CSSProperties
  children: ReactNode
} & Omit<ComponentPropsWithoutRef<'div'>, 'style' | 'color' | 'children'>) {
  return (
    <div
      {...rest}
      style={{
        position: 'absolute',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color,
        fontSize,
        transform: `translate(${x}px, ${y}px)`,
        ...(halo ? { textShadow: textHalo(halo) } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/**
 * The same line in an SVG export: two `<text>`s at the baseline `y`, a stroke
 * in the surface colour under the glyphs, since SVG paints stroke over fill
 * and a thick stroke beneath a second copy is how a halo is drawn there. Both
 * carry the size and family explicitly, because a `<text>` with neither takes
 * SVG's 16px default in a saved file.
 */
export function SvgHaloText({
  x,
  y,
  fill,
  halo,
  haloWidth,
  fontSize,
  fontFamily,
  anchor = 'start',
  children,
}: {
  x: number
  y: number
  fill: string
  halo: string
  haloWidth: number | string
  fontSize: number
  fontFamily: string
  anchor?: 'start' | 'middle' | 'end'
  children: ReactNode
}) {
  const attrs = { x, y, fontSize, fontFamily, textAnchor: anchor }
  return (
    <>
      <text
        {...attrs}
        stroke={halo}
        strokeWidth={haloWidth}
        strokeLinejoin="round"
      >
        {children}
      </text>
      <text {...attrs} fill={fill}>
        {children}
      </text>
    </>
  )
}

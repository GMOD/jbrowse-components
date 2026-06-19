// Reusable SVG-export building blocks. Co-located with `paintLayer.tsx` so
// non-LGV plugins (dotplot, linear-synteny, etc.) can use them without
// pulling in the linear-genome-view plugin. The non-component `svgReady` gate
// (interface + awaitSvgReady) lives in `./svgReady.ts` so this stays
// component-only for react-refresh.

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

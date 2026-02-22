import type { Theme } from '@mui/material'

export function ErrorBox({
  error,
  width,
  height,
  theme,
}: {
  error: unknown
  width: number
  height: number
  theme: Theme
}) {
  return (
    <>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={theme.palette.error.light}
      />
      <text x={10} y={height / 2} fill={theme.palette.error.dark} fontSize={14}>
        {`${error}`}
      </text>
    </>
  )
}

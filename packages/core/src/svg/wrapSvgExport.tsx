import { SVGExportRoot } from './SvgExport.tsx'
import { SvgThemeProviders } from './SvgThemeProviders.tsx'
import { serializeSvg } from './serializeSvg.ts'

import type { PhysicalWidth } from './figureSize.ts'
import type { ThemeOptions } from '@mui/material'

// The identical tail every view's `renderToSvg` ends in: the export theme's
// providers, the caller-supplied Wrapper, the root <svg>, and serialization to
// a file's markup. Callers keep their own layout math and children.
export function wrapSvgExport({
  theme,
  width,
  height,
  margin,
  fontFamily,
  physicalWidth,
  Wrapper = ({ children }) => children,
  children,
}: {
  theme: ThemeOptions | undefined
  width: number
  height: number
  margin?: number
  fontFamily?: string
  physicalWidth?: PhysicalWidth
  Wrapper?: React.FC<{ children: React.ReactNode }>
  children: React.ReactNode
}) {
  return serializeSvg(
    <SvgThemeProviders theme={theme}>
      <Wrapper>
        <SVGExportRoot
          width={width}
          height={height}
          margin={margin}
          fontFamily={fontFamily}
          physicalWidth={physicalWidth}
        >
          {children}
        </SVGExportRoot>
      </Wrapper>
    </SvgThemeProviders>,
  )
}

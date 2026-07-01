import { ThemeProvider } from '@mui/material'

import { SVGExportRoot } from './SvgExport.tsx'
import { createJBrowseTheme } from '../ui/theme.ts'
import { renderToStaticMarkup } from '../util/index.ts'

import type { ThemeOptions } from '@mui/material'

// The identical tail every view's `renderToSvg` ends in: resolve the export
// theme into a provider, apply the caller-supplied Wrapper, wrap the content in
// the root <svg>, and serialize to a markup string. Callers keep their own
// layout math and children — only this boilerplate lives here.
export function wrapSvgExport({
  theme,
  width,
  height,
  margin,
  Wrapper = ({ children }) => children,
  children,
}: {
  theme: ThemeOptions | undefined
  width: number
  height: number
  margin?: number
  Wrapper?: React.FC<{ children: React.ReactNode }>
  children: React.ReactNode
}) {
  return renderToStaticMarkup(
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <Wrapper>
        <SVGExportRoot width={width} height={height} margin={margin}>
          {children}
        </SVGExportRoot>
      </Wrapper>
    </ThemeProvider>,
  )
}

import { createContext, use } from 'react'

// Fixed horizontal gutter (CSS px) added to the left and right of every image
// export, giving ruler ticks and track-label backgrounds room to bleed past
// the genome content area. Lives apart from `SvgExport.tsx` so that file stays
// component-only for react-refresh.
export const exportMargin = 50

/**
 * The font-family an export's root carries: the one asked for, else
 * sans-serif, the app's own look. A root with none leaves every label to the
 * viewer's default, which is serif in browsers, librsvg and PDF converters.
 */
export function exportFontFamily(fontFamily?: string) {
  return fontFamily || 'sans-serif'
}

/**
 * The family `SVGExportRoot` writes on the root, for a component inside an
 * export to measure its text in. Undefined outside an export, where text draws
 * in the app's font.
 */
export const ExportFontFamilyContext = createContext<string | undefined>(
  undefined,
)

export function useExportFontFamily() {
  return use(ExportFontFamilyContext)
}

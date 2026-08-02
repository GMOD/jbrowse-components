import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material/styles'

// The one piece of Material UI you cannot currently drop, and it is worth being
// precise about why.
//
// Swapping the overlays (see the previous page) removes MUI *components* from
// what a display renders. It does not remove the *palette*: JBrowse's stock
// displays read theme tokens to colour their actual content -- the feature
// display reads `palette.highlight.main` for its highlight boxes, the CDS
// renderer reads `palette.framesCDS` for reading frames. Those are augmented
// entries that a default MUI theme does not have, so without this wrapper a
// feature or alignments track throws
// `Cannot read properties of undefined (reading 'main')`.
//
// So the honest boundary today is:
//
//   swappable  -- loading, error, too-large and render-error UI (the overlays)
//   required   -- the palette object, via MUI's ThemeProvider
//
// A wiggle track happens not to need it and renders fine bare, which is why the
// first three pages of this site have no ThemeProvider. Feature and alignments
// tracks do. If you are writing your own display component you control this
// entirely and can drop MUI altogether via `DisplayChromeBase`.
//
// Note this costs you a theme *object*, not a look: nothing here styles your
// chrome, and the overlays below still render with your markup.
const theme = createJBrowseTheme()

export default function Palette({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>
}

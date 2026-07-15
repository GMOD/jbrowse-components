import { makeStyles } from '@jbrowse/core/util/tss-react'

// Shared subtle look for the ambient bottom-right track-state indicator buttons
// (overflow expand/restore, isoform-collapse dropdown, ...) so they read as one
// quiet system rather than a grab-bag of differently-styled widgets.
export const useIndicatorButtonStyles = makeStyles()(theme => ({
  // consumed cross-file (GeneGlyphControl), which the same-file-only
  // unused-classes rule can't see
  // eslint-disable-next-line tss-unused-classes/unused-classes
  button: {
    padding: 2,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 3,
    '& svg': {
      fontSize: 14,
    },
    '&:hover': {
      background: theme.palette.action.hover,
    },
  },
}))

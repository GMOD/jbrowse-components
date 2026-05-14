import type { Theme } from '@mui/material'

interface BasePalette {
  A: { main: string; contrastText: string }
  C: { main: string; contrastText: string }
  G: { main: string; contrastText: string }
  T: { main: string; contrastText: string }
}

function getBases(theme: Theme): BasePalette | undefined {
  return theme.palette.bases
}

function getBaseKey(base: string): keyof BasePalette | undefined {
  switch (base.toUpperCase()) {
    case 'A':
      return 'A'
    case 'C':
      return 'C'
    case 'G':
      return 'G'
    case 'T':
    case 'U':
      return 'T'
    default:
      return undefined
  }
}

export function getBaseColor(base: string, theme: Theme): string {
  const bases = getBases(theme)
  const key = getBaseKey(base)

  if (!key) {
    return theme.palette.grey[500]
  }

  if (bases) {
    return bases[key].main
  }

  switch (key) {
    case 'A':
      return '#6dbf6d'
    case 'C':
      return '#6c6cff'
    case 'G':
      return '#ffb347'
    case 'T':
      return '#ff6b6b'
  }
}

export function getContrastText(base: string, theme: Theme): string {
  const bases = getBases(theme)
  const key = getBaseKey(base)

  if (!key) {
    return theme.palette.common.white
  }

  if (bases) {
    return bases[key].contrastText
  }

  switch (key) {
    case 'A':
    case 'C':
    case 'T':
      return '#fff'
    case 'G':
      return '#000'
  }
}

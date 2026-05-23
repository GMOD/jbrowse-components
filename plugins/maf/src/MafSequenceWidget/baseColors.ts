import type { Theme } from '@mui/material'

type BaseKey = 'A' | 'C' | 'G' | 'T'

function getBaseKey(base: string): BaseKey | undefined {
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
  const key = getBaseKey(base)
  return key ? theme.palette.bases[key].main : theme.palette.grey[500]
}

export function getContrastText(base: string, theme: Theme): string {
  const key = getBaseKey(base)
  return key
    ? theme.palette.bases[key].contrastText
    : theme.palette.common.white
}

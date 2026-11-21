import { SCROLL_ZOOM_LABEL } from '@jbrowse/core/ui/scrollZoomLabels'

export const PREFERENCE_LABELS = {
  theme: 'Theme',
  themeMode: 'Light/dark',
  animationMode: 'Animations',
  numberGrouping: 'Thousand separators in numbers',
  scrollZoom: SCROLL_ZOOM_LABEL,
  stickyViewHeaders: 'Keep view header visible',
  showBandChips: 'Name the bands inside a track',
} as const

const LABEL_BY_KEY = new Map<string, string>(Object.entries(PREFERENCE_LABELS))

export function labelPreferenceChange<
  T extends { path: string[]; label?: string },
>(change: T) {
  const label = change.label ?? LABEL_BY_KEY.get(change.path[0] ?? '')
  return label ? { ...change, label } : change
}

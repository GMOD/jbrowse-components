import { CascadingMenuButton } from '@jbrowse/core/ui'
import HeightIcon from '@mui/icons-material/Height'
import { observer } from 'mobx-react'

import { heightModeOptions } from '../baseModel.ts'
import { useIndicatorButtonStyles } from './useIndicatorButtonStyles.ts'

import type { HeightMode } from '@jbrowse/plugin-linear-genome-view'

// Persistent, subtle track-height switcher in the bottom-right indicator
// cluster. Always visible (unlike the old overflow-only toggle) so the
// height/fit strategy is discoverable, not just reachable after content already
// overflows. Opens the same Fixed / Auto / Fit options as the track menu's
// "Track height" radio; the tooltip still surfaces the scroll hint when
// overflowing.
const TrackHeightControl = observer(function TrackHeightControl({
  heightMode,
  hasOverflow,
  scrollZoom,
  onSetHeightMode,
}: {
  heightMode: HeightMode
  hasOverflow: boolean
  scrollZoom: boolean
  onSetHeightMode: (mode: HeightMode) => void
}) {
  const { classes } = useIndicatorButtonStyles()
  const tooltip = [
    'Track height',
    hasOverflow && scrollZoom ? 'shift+wheel to scroll' : undefined,
  ]
    .filter(Boolean)
    .join(' — ')
  return (
    <CascadingMenuButton
      size="small"
      className={classes.button}
      stopPropagation
      tooltip={tooltip}
      menuItems={heightModeOptions.map(option => ({
        label: option.label,
        type: 'radio' as const,
        checked: heightMode === option.value,
        onClick: () => {
          onSetHeightMode(option.value)
        },
      }))}
    >
      <HeightIcon />
    </CascadingMenuButton>
  )
})

export default TrackHeightControl

import FilterListIcon from '@mui/icons-material/ClearAll'
import PaletteIcon from '@mui/icons-material/Palette'
import { getSession } from '@jbrowse/core/util'
import { lazy } from 'react'

const FilterByTagDialog = lazy(() => import('./components/FilterByTagDialog'))

interface LinearReadDisplayModel {
  setColorScheme: (colorBy: { type: string }) => void
}

/**
 * Shared color scheme menu items for all LinearRead displays
 */
export function getColorSchemeMenuItem(model: LinearReadDisplayModel) {
  return {
    label: 'Color scheme',
    icon: PaletteIcon,
    subMenu: [
      {
        label: 'Insert size ± 3σ and orientation',
        onClick: () => {
          model.setColorScheme({ type: 'insertSizeAndOrientation' })
        },
      },
      {
        label: 'Insert size ± 3σ',
        onClick: () => {
          model.setColorScheme({ type: 'insertSize' })
        },
      },
      {
        label: 'Orientation',
        onClick: () => {
          model.setColorScheme({ type: 'orientation' })
        },
      },
      {
        label: 'Insert size gradient',
        onClick: () => {
          model.setColorScheme({ type: 'gradient' })
        },
      },
    ],
  }
}

/**
 * Shared filter by menu item for all LinearRead displays
 */
export function getFilterByMenuItem(model: unknown) {
  return {
    label: 'Filter by',
    icon: FilterListIcon,
    onClick: () => {
      // @ts-expect-error getSession works on model
      getSession(model).queueDialog((handleClose: () => void) => [
        FilterByTagDialog,
        { model, handleClose },
      ])
    },
  }
}

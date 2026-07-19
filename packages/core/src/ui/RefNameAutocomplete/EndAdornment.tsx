import { Suspense, lazy, useState } from 'react'

import MoreVertIcon from '@mui/icons-material/MoreVert'
import SearchIcon from '@mui/icons-material/Search'
import { InputAdornment } from '@mui/material'

import CascadingMenuButton from '../CascadingMenuButton.tsx'

import type { MenuItem } from '../Menu.tsx'

const HelpDialog = lazy(() => import('./HelpDialog.tsx'))

// The search-box overflow (⋮) menu: consumer-supplied rows (e.g. recent
// locations) sit above the built-in help entry. Rendered only when there is
// something to show, so a bare box keeps just its search icon.
export default function EndAdornment({
  showHelp,
  menuItems = [],
}: {
  showHelp?: boolean
  menuItems?: MenuItem[]
}) {
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const items: MenuItem[] = [
    ...menuItems,
    ...(showHelp
      ? [
          ...(menuItems.length ? [{ type: 'divider' as const }] : []),
          {
            label: 'Search box help',
            onClick: () => {
              setHelpDialogOpen(true)
            },
          },
        ]
      : []),
  ]
  return (
    <InputAdornment position="end" style={{ marginRight: 7 }}>
      <SearchIcon fontSize="small" />
      {items.length ? (
        <CascadingMenuButton
          menuItems={items}
          size="small"
          stopPropagation
          tooltip="Search box options"
        >
          <MoreVertIcon fontSize="small" />
        </CascadingMenuButton>
      ) : null}
      {helpDialogOpen ? (
        <Suspense fallback={null}>
          <HelpDialog
            handleClose={() => {
              setHelpDialogOpen(false)
            }}
          />
        </Suspense>
      ) : null}
    </InputAdornment>
  )
}

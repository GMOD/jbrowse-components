import DeleteIcon from '@mui/icons-material/Delete'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import Star from '@mui/icons-material/Star'
import StarBorder from '@mui/icons-material/StarBorder'
import TextFieldsIcon from '@mui/icons-material/TextFields'

import type { RecentSessionData } from '../types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const { ipcRenderer } = window.require('electron')

// Shared action menu for a recent session, used by both the card (grid) and the
// row (list) views so they can't drift. `includeLaunch` adds an explicit Launch
// entry for the list row, where clicking the name is the only other launch path.
export function sessionMenuItems({
  session,
  isFavorite,
  launch,
  onRename,
  onDelete,
  onToggleFavorite,
  onAddToQuickstartList,
  includeLaunch = false,
}: {
  session: RecentSessionData
  isFavorite: boolean
  launch: (path: string) => Promise<void>
  onRename: (session: RecentSessionData) => void
  onDelete: (session: RecentSessionData) => void
  onToggleFavorite: () => void
  onAddToQuickstartList?: (session: RecentSessionData) => Promise<void>
  includeLaunch?: boolean
}): MenuItem[] {
  return [
    ...(includeLaunch
      ? [
          {
            label: 'Launch',
            icon: PlayArrowIcon,
            onClick: async () => {
              await launch(session.path)
            },
          },
        ]
      : []),
    {
      label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
      icon: isFavorite ? Star : StarBorder,
      onClick: () => {
        onToggleFavorite()
      },
    },
    {
      label: 'Rename',
      icon: TextFieldsIcon,
      onClick: () => {
        onRename(session)
      },
    },
    {
      label: 'Delete',
      icon: DeleteIcon,
      onClick: () => {
        onDelete(session)
      },
    },
    ...(onAddToQuickstartList
      ? [
          {
            label: 'Add to quickstart list',
            icon: PlaylistAddIcon,
            onClick: async () => {
              await onAddToQuickstartList(session)
            },
          },
        ]
      : []),
    {
      label: 'Show in folder',
      icon: FolderOpenIcon,
      onClick: () => {
        ipcRenderer
          .invoke('showItemInFolder', session.path)
          .catch(console.error)
      },
    },
  ]
}

import DeleteIcon from '@mui/icons-material/Delete'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import Star from '@mui/icons-material/Star'
import StarBorder from '@mui/icons-material/StarBorder'
import TextFieldsIcon from '@mui/icons-material/TextFields'

import { invokeIpc } from '../../../ipc.ts'

import type { RecentSessionData } from '../types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// Shared action menu for a recent session, used by both the card (grid) and the
// row (list) views so they can't drift.
export function sessionMenuItems({
  session,
  isFavorite,
  onRename,
  onDelete,
  onToggleFavorite,
  onAddToQuickstartList,
}: {
  session: RecentSessionData
  isFavorite: boolean
  onRename: (session: RecentSessionData) => void
  onDelete: (session: RecentSessionData) => void
  onToggleFavorite: () => void
  onAddToQuickstartList?: (session: RecentSessionData) => Promise<void>
}): MenuItem[] {
  return [
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
        invokeIpc('showItemInFolder', session.path).catch(console.error)
      },
    },
  ]
}

import { formatRelativeTime } from '@jbrowse/core/util'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'

import type { SvgIconComponent } from '@mui/icons-material'

import type { SessionMetadata } from '@jbrowse/web-core'

interface SessionMenuActions {
  activate: (id: string) => Promise<void>
  showMore: () => void
}

interface SessionMenuItem {
  label: string
  disabled?: boolean
  icon?: SvgIconComponent
  onClick: () => void
}

function sessionLabel(
  r: SessionMetadata,
  currentSessionId: string | undefined,
) {
  const suffix =
    r.id === currentSessionId ? 'current' : formatRelativeTime(r.createdAt)
  return `${r.name} (${suffix})`
}

function sessionItem(
  r: SessionMetadata,
  currentSessionId: string | undefined,
  actions: SessionMenuActions,
  icon?: SvgIconComponent,
): SessionMenuItem {
  return {
    label: sessionLabel(r, currentSessionId),
    disabled: r.id === currentSessionId,
    icon,
    onClick: () => {
      // activate handles its own errors (console.error + notifyError)
      void actions.activate(r.id)
    },
  }
}

function moreItem(showMore: () => void): SessionMenuItem {
  return {
    label: 'More...',
    icon: FolderOpenIcon,
    onClick: () => {
      showMore()
    },
  }
}

export function buildSessionListSubmenu({
  sessions,
  currentSessionId,
  actions,
  itemIcon,
  emptyLabel,
}: {
  sessions: SessionMetadata[] | undefined
  currentSessionId: string | undefined
  actions: SessionMenuActions
  itemIcon?: SvgIconComponent
  emptyLabel?: string
}): SessionMenuItem[] {
  return sessions?.length
    ? [
        ...sessions.map(r =>
          sessionItem(r, currentSessionId, actions, itemIcon),
        ),
        moreItem(actions.showMore),
      ]
    : emptyLabel
      ? [{ label: emptyLabel, onClick: () => {} }]
      : []
}

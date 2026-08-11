import { formatRelativeTime } from '@jbrowse/core/util'
import { sessionLastUsed } from '@jbrowse/web-core'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import StarIcon from '@mui/icons-material/Star'

import type { SessionMetadata } from '@jbrowse/web-core'
import type { SvgIconComponent } from '@mui/icons-material'

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
    r.id === currentSessionId
      ? 'current'
      : formatRelativeTime(sessionLastUsed(r))
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

// What the saved-session menus need from the root model. A structural host
// rather than WebRootModel: this is called from inside the model factory's
// `.views`, where `self` is the partial chain type — the same reason
// ConfigModelParent and SessionModelParent are shadows.
export interface SavedSessionMenuHost {
  savedSessionMetadata?: SessionMetadata[]
  session?: {
    id: string
    addWidget: (typeName: string, id: string) => unknown
    showWidget: (widget: unknown) => void
  }
  activateSession: (id: string) => Promise<void>
}

// how many rows each list shows before deferring to its "More..." item
const MAX_SHOWN = 5

/**
 * The saved-session section of the File menu: a favorites submenu when there
 * are favorites, and the recent one always — so "No autosaves found" has
 * somewhere to live. Built here rather than inline in the root model's `menus()`
 * so the whole saved-session surface sits next to the per-row work
 * (buildSessionListSubmenu), and the File menu reads as the list of sections it
 * is.
 */
export function savedSessionMenuItems(self: SavedSessionMenuHost) {
  const currentSessionId = self.session?.id
  const favorites = self.savedSessionMetadata
    ?.filter(f => f.favorite)
    .slice(0, MAX_SHOWN)
  // the open session is excluded rather than shown disabled. The autosave
  // autorun restamps its `updatedAt` every 400ms, so it is *always* the newest
  // row — a disabled entry permanently occupying the top of the recent list and
  // costing it one of its five slots. Favorites keep theirs, where the row says
  // something ("this starred session is the one you are in") rather than
  // nothing.
  const recent = self.savedSessionMetadata
    ?.filter(f => !f.favorite && f.id !== currentSessionId)
    .slice(0, MAX_SHOWN)
  const actions = {
    activate: (id: string) => self.activateSession(id),
    showMore: () => {
      const widget = self.session?.addWidget('SessionManager', 'sessionManager')
      if (widget) {
        self.session?.showWidget(widget)
      }
    },
  }
  return [
    ...(favorites?.length
      ? [
          {
            label: 'Favorite sessions...',
            subMenu: buildSessionListSubmenu({
              sessions: favorites,
              currentSessionId,
              actions,
              itemIcon: StarIcon,
            }),
          },
        ]
      : []),
    {
      label: 'Recent sessions...',
      subMenu: buildSessionListSubmenu({
        sessions: recent,
        currentSessionId,
        actions,
        emptyLabel: 'No autosaves found',
      }),
    },
  ]
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

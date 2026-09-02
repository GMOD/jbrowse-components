import { useState } from 'react'

import {
  CascadingMenuButton,
  ErrorMessage,
  LabeledCheckbox,
} from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { mutate, useFetch } from '@jbrowse/core/util/useFetch'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import DeleteIcon from '@mui/icons-material/Delete'
import OpenIcon from '@mui/icons-material/FolderOpen'
import LinkIcon from '@mui/icons-material/Link'
import ListIcon from '@mui/icons-material/List'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import ViewComfyIcon from '@mui/icons-material/ViewComfy'
import {
  Button,
  FormControl,
  IconButton,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'

import { invokeIpc } from '../../../ipc.ts'
import { useNotifyError } from '../../NotifyContext.ts'
import OpenLinkDialog from '../../OpenLinkDialog.tsx'
import DeleteSessionDialog from '../dialogs/DeleteSessionDialog.tsx'
import RenameSessionDialog from '../dialogs/RenameSessionDialog.tsx'
import { useInnerDims } from '../useInnerDims.ts'
import { loadPluginManager, openSpecLink } from '../util.tsx'
import RecentSessionsCards from './RecentSessionsCards.tsx'
import RecentSessionsDataGrid from './RecentSessionsDataGrid.tsx'
import { useFavoriteSessions } from './useFavoriteSessions.ts'

import type { RecentSessionData } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { ToggleButtonProps } from '@mui/material'

const useStyles = makeStyles()({
  flex: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    // a narrow panel used to crush the row's items below their content width,
    // clipping the open button's label; let it spill onto a second line instead
    flexWrap: 'wrap',
  },
  openButton: {
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  label: {
    whiteSpace: 'nowrap',
  },
})

type RecentSessions = RecentSessionData[]

function ToggleButtonWithTooltip({
  title = '',
  children,
  ...rest
}: ToggleButtonProps) {
  return (
    <Tooltip title={title}>
      <ToggleButton {...rest}>{children}</ToggleButton>
    </Tooltip>
  )
}

function IconButtonWithTooltip({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          disabled={disabled}
          onClick={() => {
            onClick()
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}

export default function RecentSessionPanel({
  setPluginManager,
}: {
  setPluginManager: (pm: PluginManager) => void
}) {
  const { classes } = useStyles()
  const notifyError = useNotifyError()
  const { height: innerHeight } = useInnerDims()
  const [displayMode, setDisplayMode] = useLocalStorage('displayMode', 'list')
  const [sessionToRename, setSessionToRename] = useState<RecentSessionData>()
  const [selectedSessions, setSelectedSessions] = useState<RecentSessions>([])
  const [sessionsToDelete, setSessionsToDelete] = useState<RecentSessions>()
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<HTMLElement>()
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [now] = useState(() => Date.now())
  const [showAutosaves, setShowAutosaves] = useLocalStorage(
    'showAutosaves',
    true,
  )
  const [showFavoritesOnly, setShowFavoritesOnly] = useLocalStorage(
    'showFavoritesOnly',
    false,
  )
  const { isFavorite, toggleFavorite, pruneTo } = useFavoriteSessions()
  const {
    data: sessions = [],
    error: listSessionsError,
    mutate: refreshSessions,
  } = useFetch(
    ['listSessions'],
    async () =>
      (await invokeIpc('listSessions')).map(s => ({
        ...s,
        // An entry is written from the config's own defaultSession, which need
        // not carry a name (a hub config's usually doesn't); the session model
        // resolves one for itself but the recent-sessions row keeps the gap
        // until the first autosave rewrites it. Rendering that gap put the
        // literal string "undefined" in the card and the grid.
        name: s.name ?? 'Untitled session',
      })),
    { onSuccess: pruneTo },
  )

  const launch = async (path: string) => {
    try {
      setPluginManager(await loadPluginManager(path))
    } catch (e) {
      console.error(e)
      notifyError(e, {
        label: 'Remove from recent sessions',
        onClick: () => {
          invokeIpc('removeRecentSession', path)
            .then(() => {
              refreshSessions()
            })
            .catch(console.error)
        },
      })
    }
  }

  // the native picker is the same one File -> Open uses, so the start screen and
  // the in-session menu share its filters and default directory
  const promptOpenFile = async () => {
    const path = await invokeIpc('promptOpenFile')
    if (path) {
      await launch(path)
    }
  }

  async function addToQuickstartList(arg: RecentSessionData[]) {
    try {
      await Promise.all(
        arg.map(s => invokeIpc('addToQuickstartList', s.path, s.name)),
      )
      // Revalidate the QuickstartPanel now that the list has changed on disk
      mutate('listQuickstarts')
    } catch (e) {
      console.error(e)
      notifyError(e)
    }
  }

  const sortedSessions = sessions.toSorted((a, b) => b.updated - a.updated)
  const filteredSessions = sortedSessions.filter(
    f =>
      (showAutosaves || !f.isAutosave) &&
      (!showFavoritesOnly || isFavorite(f.path)),
  )
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  const oldAutosaves = sessions.filter(
    f => f.isAutosave && now - f.updated > thirtyDaysMs,
  )
  // The grid doesn't re-emit its selection when a filter toggle hides rows, so
  // selectedSessions can outlive the visible list. Intersect before acting so
  // delete/quickstart never touch a session the user can no longer see.
  const visiblePaths = new Set(filteredSessions.map(s => s.path))
  const visibleSelection = selectedSessions.filter(s =>
    visiblePaths.has(s.path),
  )

  return (
    <div>
      {listSessionsError ? <ErrorMessage error={listSessionsError} /> : null}
      {sessionToRename ? (
        <RenameSessionDialog
          sessionToRename={sessionToRename}
          onClose={() => {
            setSessionToRename(undefined)
            refreshSessions()
          }}
        />
      ) : null}
      {sessionsToDelete ? (
        <DeleteSessionDialog
          sessionsToDelete={sessionsToDelete}
          onClose={() => {
            setSessionsToDelete(undefined)
            refreshSessions()
          }}
        />
      ) : null}
      {linkDialogOpen ? (
        <OpenLinkDialog
          onSubmit={async link => {
            setPluginManager(await openSpecLink(link))
          }}
          onClose={() => {
            setLinkDialogOpen(false)
          }}
        />
      ) : null}
      <div className={classes.flex}>
        <FormControl>
          <ToggleButtonGroup
            exclusive
            value={displayMode}
            onChange={(_, newVal) => {
              if (newVal) {
                setDisplayMode(newVal)
              }
            }}
          >
            <ToggleButtonWithTooltip value="grid" title="Grid view">
              <ViewComfyIcon />
            </ToggleButtonWithTooltip>
            <ToggleButtonWithTooltip value="list" title="List view">
              <ListIcon />
            </ToggleButtonWithTooltip>
          </ToggleButtonGroup>
        </FormControl>
        {displayMode === 'list' ? (
          <div style={{ display: 'flex' }}>
            <IconButtonWithTooltip
              title="Delete sessions"
              disabled={!visibleSelection.length}
              onClick={() => {
                setSessionsToDelete(visibleSelection)
              }}
            >
              <DeleteIcon />
            </IconButtonWithTooltip>
            <IconButtonWithTooltip
              title="Add sessions to quickstart list"
              disabled={!visibleSelection.length}
              onClick={async () => {
                await addToQuickstartList(visibleSelection)
              }}
            >
              <PlaylistAddIcon />
            </IconButtonWithTooltip>
          </div>
        ) : null}
        <Tooltip title="More actions">
          <IconButton
            onClick={event => {
              setMoreMenuAnchor(event.currentTarget)
            }}
          >
            <MoreVertIcon />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={moreMenuAnchor}
          open={Boolean(moreMenuAnchor)}
          onClose={() => {
            setMoreMenuAnchor(undefined)
          }}
        >
          <MenuItem
            disabled={!oldAutosaves.length}
            onClick={() => {
              setMoreMenuAnchor(undefined)
              setSessionsToDelete(oldAutosaves)
            }}
          >
            {oldAutosaves.length
              ? `Delete ${oldAutosaves.length} autosave${oldAutosaves.length === 1 ? '' : 's'} older than 30 days`
              : 'No autosaves older than 30 days'}
          </MenuItem>
        </Menu>
        <LabeledCheckbox
          className={classes.label}
          label="Show autosaves"
          checked={showAutosaves}
          onChange={val => {
            setShowAutosaves(val)
          }}
        />
        <LabeledCheckbox
          className={classes.label}
          label="Show favorites only"
          checked={showFavoritesOnly}
          onChange={val => {
            setShowFavoritesOnly(val)
          }}
        />

        <CascadingMenuButton
          ButtonComponent={Button}
          className={classes.openButton}
          variant="contained"
          endIcon={<ArrowDropDownIcon />}
          tooltip="Open a .jbrowse or config.json file, or a JBrowse Web link"
          menuItems={[
            {
              label: 'Open .jbrowse or config.json file...',
              icon: OpenIcon,
              onClick: () => {
                promptOpenFile().catch((e: unknown) => {
                  console.error(e)
                  notifyError(e)
                })
              },
            },
            {
              label: 'Open JBrowse Web link...',
              icon: LinkIcon,
              onClick: () => {
                setLinkDialogOpen(true)
              },
            },
          ]}
        >
          Open file or link
        </CascadingMenuButton>
      </div>

      {!filteredSessions.length ? (
        <Typography>
          {showFavoritesOnly && sortedSessions.length
            ? 'No favorite sessions'
            : 'No sessions available'}
        </Typography>
      ) : (
        // both views scroll inside half the window rather than pushing the
        // start screen's own page scroll, so the panel owns the box
        <div style={{ maxHeight: innerHeight / 2, overflow: 'auto' }}>
          {displayMode === 'grid' ? (
            <RecentSessionsCards
              launch={launch}
              addToQuickstartList={entry => addToQuickstartList([entry])}
              sessions={filteredSessions}
              setSessionsToDelete={setSessionsToDelete}
              setSessionToRename={setSessionToRename}
              isFavorite={isFavorite}
              toggleFavorite={toggleFavorite}
            />
          ) : (
            <RecentSessionsDataGrid
              launch={launch}
              setSelectedSessions={setSelectedSessions}
              setSessionToRename={setSessionToRename}
              setSessionsToDelete={setSessionsToDelete}
              sessions={filteredSessions}
              isFavorite={isFavorite}
              toggleFavorite={toggleFavorite}
              addToQuickstartList={entry => addToQuickstartList([entry])}
            />
          )}
        </div>
      )}
    </div>
  )
}

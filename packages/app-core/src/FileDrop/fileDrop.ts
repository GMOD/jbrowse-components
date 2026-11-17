import { fileToLocation } from '@jbrowse/core/util'
import {
  classifyFilename,
  isSequenceRole,
} from '@jbrowse/core/util/assemblyConfigUtils'

import type { SessionWithWidgets, Widget } from '@jbrowse/core/util'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { DragEvent } from 'react'

export interface FileDropRoutes {
  sessionFileExtensions: string[]
  openSessionFile: (file: File) => Promise<void>
  openGenomeFiles: (locations: FileLocation[]) => void
}

interface FileStagingWidget extends Widget {
  view?: { id: string }
  stageLocations: (locations: FileLocation[]) => void
}

function isFileStagingWidget(widget: Widget): widget is FileStagingWidget {
  return 'stageLocations' in widget
}

export function routeDroppedFiles<T extends { name: string }>(
  files: T[],
  sessionFileExtensions: string[],
) {
  const [first] = files
  return files.length === 1 &&
    first &&
    sessionFileExtensions.some(ext => first.name.toLowerCase().endsWith(ext))
    ? { kind: 'session' as const, file: first }
    : files.some(file => isSequenceRole(classifyFilename(file.name)))
      ? { kind: 'genome' as const, files }
      : { kind: 'tracks' as const, files }
}

/**
 * A drop on a menu or dialog reaches a wrapper through React's portal bubbling,
 * so only one landing inside the wrapper's own DOM counts, and not one an inner
 * drop zone already took. Requiring 'Files' keeps internal drags (track
 * reordering, workspace panels) out.
 */
export function acceptsFileDrop(event: DragEvent<HTMLElement>) {
  return (
    !event.defaultPrevented &&
    event.dataTransfer.types.includes('Files') &&
    event.target instanceof Node &&
    event.currentTarget.contains(event.target)
  )
}

export function droppedOnViewId(target: EventTarget) {
  return target instanceof Element
    ? target.closest<HTMLElement>('[data-view-id]')?.dataset.viewId
    : undefined
}

export function openDroppedTracks(
  session: SessionWithWidgets,
  locations: FileLocation[],
  viewId?: string,
) {
  const droppedOn = session.views.find(v => v.id === viewId)
  const openForm = session.activeWidgets.get('addTrackWidget')
  if (
    !droppedOn &&
    openForm &&
    isFileStagingWidget(openForm) &&
    openForm.view
  ) {
    session.showWidget(openForm)
    openForm.stageLocations(locations)
  } else {
    const view = droppedOn ?? session.views[0]
    if (view) {
      const widget = session.openWidget('AddTrackWidget', 'addTrackWidget', {
        view: view.id,
      })
      if (isFileStagingWidget(widget)) {
        widget.stageLocations(locations)
      }
    } else {
      session.notify('Open a view to add the dropped tracks to first')
    }
  }
}

function isOnDisk(location: FileLocation) {
  return !('localPath' in location) || Boolean(location.localPath)
}

export async function openDroppedFiles({
  session,
  routes,
  files,
  viewId,
}: {
  session: SessionWithWidgets
  routes: FileDropRoutes
  files: File[]
  viewId?: string
}) {
  const route = routeDroppedFiles(files, routes.sessionFileExtensions)
  try {
    if (route.kind === 'session') {
      await routes.openSessionFile(route.file)
    } else {
      const locations = route.files.map(fileToLocation).filter(isOnDisk)
      const skipped = route.files.length - locations.length
      if (skipped > 0) {
        session.notify(
          `${skipped} of the dropped files ${skipped === 1 ? 'is' : 'are'} not on disk, so ${skipped === 1 ? 'it was' : 'they were'} left out`,
        )
      }
      if (locations.length > 0) {
        if (route.kind === 'genome') {
          routes.openGenomeFiles(locations)
        } else {
          openDroppedTracks(session, locations, viewId)
        }
      }
    }
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
  }
}

export function fileDropHandlers(
  session: SessionWithWidgets,
  routes: FileDropRoutes | undefined,
) {
  return routes
    ? {
        onDragOver: (event: DragEvent<HTMLElement>) => {
          if (acceptsFileDrop(event)) {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }
        },
        onDrop: (event: DragEvent<HTMLElement>) => {
          if (acceptsFileDrop(event)) {
            event.preventDefault()
            void openDroppedFiles({
              session,
              routes,
              files: [...event.dataTransfer.files],
              viewId: droppedOnViewId(event.target),
            })
          }
        },
      }
    : {}
}

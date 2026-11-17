import { fileToLocation } from '@jbrowse/core/util'
import {
  classifyFilename,
  isSequenceRole,
} from '@jbrowse/core/util/assemblyConfigUtils'

import type { SessionWithWidgets, Widget } from '@jbrowse/core/util'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { DragEvent } from 'react'

/**
 * What a product does with a dropped session file and a dropped genome. Tracks
 * need nothing product-specific, so they are handled here.
 */
export interface FileDropRoutes {
  sessionFileExtensions: string[]
  openSessionFile: (file: File) => Promise<void>
  openGenomeFiles: (locations: FileLocation[]) => void
}

interface FileStagingWidget extends Widget {
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
  viewId?: string | null,
) {
  const view = session.views.find(v => v.id === viewId) ?? session.views[0]
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

export async function openDroppedFiles({
  session,
  routes,
  files,
  viewId,
}: {
  session: SessionWithWidgets
  routes: FileDropRoutes
  files: File[]
  viewId?: string | null
}) {
  const route = routeDroppedFiles(files, routes.sessionFileExtensions)
  try {
    if (route.kind === 'session') {
      await routes.openSessionFile(route.file)
    } else if (route.kind === 'genome') {
      routes.openGenomeFiles(route.files.map(fileToLocation))
    } else if (route.files.length > 0) {
      openDroppedTracks(session, route.files.map(fileToLocation), viewId)
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

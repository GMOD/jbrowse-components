import { isBaseSession } from './BaseSession'

import type { DialogComponentType } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface SessionWithDialogs {
  queueOfDialogs: [DialogComponentType, unknown][]
  queueDialog(
    cb: (doneCallback: () => void) => [DialogComponentType, unknown],
  ): void
  removeActiveDialog(): void
}

export function isSessionWithDialogs(
  session: IAnyStateTreeNode,
): session is SessionWithDialogs {
  return isBaseSession(session) && 'queueOfDialogs' in session
}

export interface SessionWithConnections {
  connectionInstances: unknown[]
  makeConnection(configuration: unknown, initialSnapshot?: unknown): unknown
  breakConnection(configuration: unknown): void
  addConnectionConf(connectionConf: unknown): unknown
}

export function isSessionWithConnections(
  session: IAnyStateTreeNode,
): session is SessionWithConnections {
  return isBaseSession(session) && 'connectionInstances' in session
}

export interface SessionWithMultipleViews {
  views: unknown[]
  stickyViewHeaders: boolean
  addView(typeName: string, initialState?: unknown): unknown
  removeView(view: unknown): void
}

export function isSessionWithMultipleViews(
  session: IAnyStateTreeNode,
): session is SessionWithMultipleViews {
  return isBaseSession(session) && 'views' in session
}

export interface SessionWithTracks {
  tracks: unknown[]
  addTrackConf(configuration: unknown): unknown
  deleteTrackConf(configuration: unknown): unknown
}

export function isSessionWithTracks(
  thing: IAnyStateTreeNode,
): thing is SessionWithTracks {
  return isBaseSession(thing) && 'tracks' in thing
}

export interface SessionWithThemes {
  themeName: string | undefined
  setThemeName(name: string): void
}

export function isSessionWithThemes(
  session: IAnyStateTreeNode,
): session is SessionWithThemes {
  return isBaseSession(session) && 'themeName' in session
}

export interface SessionWithReferenceManagement {
  getReferring(target: unknown): unknown[]
  removeReferring(
    referring: unknown[],
    target: unknown,
    callbacks: (() => void)[],
    derefTypeCount: Record<string, number>,
  ): void
}

export function isSessionWithReferenceManagement(
  thing: IAnyStateTreeNode,
): thing is SessionWithReferenceManagement {
  return isBaseSession(thing) && 'getReferring' in thing
}

export interface SessionWithDrawerWidgets {
  widgets: Map<string, unknown>
  activeWidgets: Map<string, unknown>
  addWidget(
    typeName: string,
    id: string,
    initialState?: Record<string, unknown>,
    conf?: unknown,
  ): unknown
  showWidget(widget: unknown): void
  hideWidget(widget: unknown): void
}

export function isSessionWithDrawerWidgets(
  session: IAnyStateTreeNode,
): session is SessionWithDrawerWidgets {
  return isBaseSession(session) && 'widgets' in session
}

export interface SessionWithSessionTracks {
  sessionTracks: unknown[]
}

export function isSessionWithSessionTracks(
  session: IAnyStateTreeNode,
): session is SessionWithSessionTracks {
  return isBaseSession(session) && 'sessionTracks' in session
}

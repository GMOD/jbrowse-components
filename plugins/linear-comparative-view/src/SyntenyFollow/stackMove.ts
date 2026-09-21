import { isAlive } from '@jbrowse/mobx-state-tree'
import { runInAction } from 'mobx'

import type { FollowAnchorHost } from './followHost.ts'
import type { NotificationSink, Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface FollowAnchorTake {
  taken: boolean
  release: () => void
  hold: <T>(fn: () => T) => T
}

function noFollowAnchor(): FollowAnchorTake {
  return {
    taken: false,
    release() {},
    hold: fn => fn(),
  }
}

// Point the follow at `row` for a navigation, and hand back the undo. Taken
// before the navigation, because the follow propagates away from the anchor
// and a row navigated while another holds it is pulled straight back.
// `release` is safe on any path and any number of times: it writes only while
// the host is alive and the anchor is still the one this take set.
export function takeFollowAnchor(
  host: FollowAnchorHost,
  row: number,
): FollowAnchorTake {
  const previous = host.followAnchorIndex
  const anchored = host.views[row]
  const taken = host.followSynteny && previous !== row
  if (taken) {
    host.setFollowAnchorIndex(row)
  }
  return {
    taken,
    hold: fn => host.holdFollowAnchor(fn),
    release() {
      // by node, since a removal renumbers the rows
      if (taken && isAlive(host)) {
        const holder = host.views.indexOf(anchored)
        if (holder !== -1 && host.followAnchorIndex === holder) {
          host.setFollowAnchorIndex(previous)
        }
      }
    },
  }
}

// A bp window rather than a pixel pair: a snackbar carrying an action never
// auto-hides, so the capture and its Undo can be a resize apart
function captureRowViewport(view: LinearGenomeViewModel) {
  const regions: Region[] = [...view.displayedRegions]
  const { windowWidthBp, windowStartBp } = view
  return () => {
    if (isAlive(view)) {
      view.setDisplayedRegions(regions)
      view.setWindow(windowWidthBp, windowStartBp)
    }
  }
}

// Every row, since the follow re-places the others when one takes the anchor
export function captureStackViewports(views: LinearGenomeViewModel[]) {
  const restores = views.map(view => captureRowViewport(view))
  return () => {
    for (const restore of restores) {
      restore()
    }
  }
}

// A stack of rows, following or not: BreakpointSplitView has no follow at all
export interface StackMoveHost
  extends IStateTreeNode, Partial<Omit<FollowAnchorHost, 'views'>> {
  views: LinearGenomeViewModel[]
}

// The members are one fact, so they are tested as one: a stack carrying
// `followSynteny` but no setter would take an optional call and write nothing
function hasFollow(
  stack: StackMoveHost,
): stack is StackMoveHost & FollowAnchorHost {
  return (
    typeof stack.followSynteny === 'boolean' &&
    typeof stack.followAnchorIndex === 'number' &&
    typeof stack.setFollowAnchorIndex === 'function' &&
    typeof stack.holdFollowAnchor === 'function'
  )
}

// How every navigation that moves the stack begins: every row's viewport
// captured for the Undo, then the anchor taken for the row that drives. In
// that order, because the take already re-places the other rows.
export function beginStackMove(stack: StackMoveHost, row: number) {
  const restore = captureStackViewports([...stack.views])
  const anchor = hasFollow(stack)
    ? takeFollowAnchor(stack, row)
    : noFollowAnchor()
  return { restore, anchor }
}

// The snackbar every stack-moving navigation posts, with the Undo that puts
// every row's viewport back and gives the anchor back in one transaction, so
// the follow sees the settled pre-click state rather than a half-restored one
export function notifyStackMove({
  session,
  loc,
  anchor,
  restore,
  followNote,
}: {
  session: NotificationSink
  loc: string
  anchor: FollowAnchorTake
  restore: () => void
  // how the snackbar names the row the anchor went to
  followNote: string
}) {
  session.notify(
    anchor.taken ? `Showing ${loc}, ${followNote}` : `Showing ${loc}`,
    'info',
    {
      name: 'Undo',
      onClick: () => {
        runInAction(() => {
          restore()
          anchor.release()
        })
      },
    },
  )
}

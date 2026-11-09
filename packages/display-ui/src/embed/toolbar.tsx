import { SearchResultsNotFoundError } from '@jbrowse/core/util/locString'
import { getSession } from '@jbrowse/core/util/mstUtils'
import { observer } from 'mobx-react'

import type { HighlightInput } from '@jbrowse/core/util/highlights'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type React from 'react'

export const Toolbar = observer(function Toolbar({
  style,
  children,
}: {
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        paddingBottom: 8,
        fontSize: '0.85rem',
        ...style,
      }}
    >
      {children}
    </div>
  )
})

export interface NavView extends IStateTreeNode {
  navToLocString: (input: string) => Promise<unknown>
}

export interface HighlightingNavView extends NavView {
  setHighlights: (highlights: readonly (string | HighlightInput)[]) => void
}

/**
 * Moves the view to `loc`. Given `highlight`, it also replaces the view's
 * highlights, each written as the launch spec's `highlight` writes one, so a
 * link can mark the place it points at. A name search that matches nothing
 * reaches the session as a warning naming the term; any other failure is an
 * error.
 */
export const NavButton = observer(function NavButton(
  props: (
    | { view: NavView; highlight?: never }
    | {
        view: HighlightingNavView
        highlight: readonly (string | HighlightInput)[]
      }
  ) & {
    loc: string
    onClick?: () => void
    style?: React.CSSProperties
    children?: React.ReactNode
  },
) {
  const { view, loc, onClick, style, children } = props
  return (
    <button
      type="button"
      style={style}
      onClick={() => {
        onClick?.()
        const report = (e: unknown) => {
          const session = getSession(view)
          if (e instanceof SearchResultsNotFoundError) {
            session.notify(e.message, 'warning')
          } else {
            session.notifyError(`${e}`, e)
          }
        }
        try {
          if (props.highlight) {
            props.view.setHighlights(props.highlight)
          }
        } catch (e) {
          report(e)
        }
        view.navToLocString(loc).catch(report)
      }}
    >
      {children ?? loc}
    </button>
  )
})

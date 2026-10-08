import { getSession } from '@jbrowse/core/util/mstUtils'
import { observer } from 'mobx-react'

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

export const NavButton = observer(function NavButton({
  view,
  loc,
  onClick,
  style,
  children,
}: {
  view: NavView
  loc: string
  onClick?: () => void
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      style={style}
      onClick={() => {
        onClick?.()
        view.navToLocString(loc).catch((e: unknown) => {
          getSession(view).notifyError(`${e}`, e)
        })
      }}
    >
      {children ?? loc}
    </button>
  )
})

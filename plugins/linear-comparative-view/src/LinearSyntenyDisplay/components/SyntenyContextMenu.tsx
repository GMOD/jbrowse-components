import React from 'react'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { Menu } from '@jbrowse/core/ui'

// locals
import { LinearSyntenyDisplayModel } from '../model'
import { LinearSyntenyViewModel } from '../../LinearSyntenyView/model'

interface ClickCoord {
  clientX: number
  clientY: number
  feature: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export default function SyntenyContextMenu({
  model,
  onClose,
  anchorEl,
}: {
  onClose: () => void
  model: LinearSyntenyDisplayModel
  anchorEl: ClickCoord
}) {
  const view = getContainingView(model) as LinearSyntenyViewModel
  const { clientX, clientY, feature } = anchorEl
  return (
    <Menu
      onMenuItemClick={(event, callback) => {
        callback(event)
        onClose()
      }}
      anchorEl={{
        nodeType: 1,
        getBoundingClientRect: () => {
          const x = clientX
          const y = clientY
          return {
            top: y,
            left: x,
            bottom: y,
            right: x,
            width: 0,
            height: 0,
            x,
            y,
            toJSON() {},
          }
        },
      }}
      onClose={onClose}
      open={Boolean(anchorEl)}
      menuItems={[
        {
          label: 'Center on feature',
          onClick: () => {
            const { f } = feature
            const start = f.get('start')
            const end = f.get('end')
            const refName = f.get('refName')
            const mate = f.get('mate')
            view.views[0]
              .navToLocString(`${refName}:${start}-${end}`)
              .catch(e => {
                console.error(e)
                getSession(model).notify(`${e}`, 'error')
              })
            view.views[1]
              .navToLocString(`${mate.refName}:${mate.start}-${mate.end}`)
              .catch(e => {
                console.error(e)
                getSession(model).notify(`${e}`, 'error')
              })
          },
        },
      ]}
    />
  )
}

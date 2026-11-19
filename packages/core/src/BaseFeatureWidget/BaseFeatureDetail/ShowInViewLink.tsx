import { observer } from 'mobx-react'

import ActionLink from '../../ui/ActionLink.tsx'

/** `children` as a link that moves the view there, or as plain text when `go` is unset. */
const ShowInViewLink = observer(function ShowInViewLink({
  go,
  children,
}: {
  go: (() => void) | undefined
  children: React.ReactNode
}) {
  return go ? (
    <ActionLink title="Show in view" onClick={go}>
      {children}
    </ActionLink>
  ) : (
    children
  )
})

export default ShowInViewLink

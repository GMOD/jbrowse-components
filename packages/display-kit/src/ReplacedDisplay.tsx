import type { ReactNode } from 'react'

/**
 * The two phases that replace the whole chrome with a banner still say which
 * display is showing it, so a capture can tell a banner from a display that
 * never mounted. No `data-testid`: that names a display whose body is on
 * screen, and `display: contents` keeps the banner's own box the layout.
 */
export default function ReplacedDisplay({
  model,
  phase,
  children,
}: {
  model: { configuration: { displayId: string } }
  phase: 'tooLarge' | 'renderError'
  children: ReactNode
}) {
  return (
    <div
      style={{ display: 'contents' }}
      data-display-id={model.configuration.displayId}
      data-display-phase={phase}
    >
      {children}
    </div>
  )
}

import { Suspense, lazy } from 'react'
import type { ReactNode } from 'react'

// type-only: erased at build, so it does not pull react-dropzone into this chunk
import type { Accept, FileRejection } from 'react-dropzone'

// react-dropzone + file-selector (~110KB) load only when a dropzone actually
// renders. FileDropZone is only ever shown inside lazy add-track/import/assembly
// dialogs, so deferring it behind this boundary keeps it off the cold-load path.
const FileDropZoneInner = lazy(() => import('./FileDropZoneInner.tsx'))

/**
 * Shared dashed-border file dropzone (drag-and-drop plus click-to-browse) used
 * by the bulk add-track, multi-wiggle, assembly, and session-import forms. The
 * `onDrop` signature mirrors react-dropzone so callers can inspect rejected
 * files. Pass `message` to replace the default prompt and `children` for extra
 * content (e.g. a Browse button).
 */
export default function FileDropZone(props: {
  onDrop: (accepted: File[], rejected: FileRejection[]) => void
  accept?: Accept
  maxSize?: number
  multiple?: boolean
  message?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <Suspense fallback={null}>
      <FileDropZoneInner {...props} />
    </Suspense>
  )
}

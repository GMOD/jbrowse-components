import { useRef, useState } from 'react'

import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { Typography, alpha } from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'

import type { DragEvent, KeyboardEvent, ReactNode } from 'react'

// map of MIME type -> allowed file extensions, e.g. { 'application/json':
// ['.json'] }. Mirrors the react-dropzone shape we used to depend on.
export type Accept = Record<string, string[]>

export interface FileRejection {
  file: File
  errors: { code: string; message: string }[]
}

const useStyles = makeStyles()(theme => ({
  dropZone: {
    textAlign: 'center',
    padding: theme.spacing(2),
    borderWidth: 2,
    borderRadius: 2,
    borderStyle: 'dashed',
    outline: 'none',
    cursor: 'pointer',
    transition: 'border .24s ease-in-out, background-color .24s ease-in-out',
  },
  dropZoneActive: {
    borderColor: theme.palette.secondary.light,
    backgroundColor: alpha(
      theme.palette.text.primary,
      theme.palette.action.hoverOpacity,
    ),
  },
  dropZoneInactive: {
    borderColor: theme.palette.divider,
    backgroundColor: theme.palette.background.default,
  },
  uploadIcon: {
    color: theme.palette.text.secondary,
  },
}))

// a file matches an Accept entry if its extension is listed or its MIME type
// matches a key (with trailing-slash glob support, e.g. 'image/*')
function mimeMatches(fileType: string, pattern: string) {
  return pattern.endsWith('/*')
    ? fileType.startsWith(pattern.slice(0, -1))
    : fileType === pattern
}

function validate(file: File, accept?: Accept, maxSize?: number) {
  const errors: FileRejection['errors'] = []
  if (maxSize !== undefined && file.size > maxSize) {
    errors.push({
      code: 'file-too-large',
      message: `File is larger than ${maxSize} bytes`,
    })
  }
  if (accept) {
    const name = file.name.toLowerCase()
    const extOk = Object.values(accept)
      .flat()
      .some(ext => name.endsWith(ext.toLowerCase()))
    const mimeOk = Object.keys(accept).some(m => mimeMatches(file.type, m))
    if (!extOk && !mimeOk) {
      const allowed = Object.entries(accept)
        .flatMap(([mime, exts]) => [mime, ...exts])
        .join(', ')
      errors.push({
        code: 'file-invalid-type',
        message: `File type must be ${allowed}`,
      })
    }
  }
  return errors
}

/**
 * Shared dashed-border file dropzone (drag-and-drop plus click-to-browse) used
 * by the bulk add-track, multi-wiggle, assembly, and session-import forms. The
 * `onDrop` signature reports accepted files and, when `accept`/`maxSize` are
 * set, rejected files with their validation errors. Pass `message` to replace
 * the default prompt and `children` for extra content (e.g. a Browse button).
 */
export default function FileDropZone({
  onDrop,
  accept,
  maxSize,
  multiple = true,
  message,
  children,
  className,
}: {
  onDrop: (accepted: File[], rejected: FileRejection[]) => void
  accept?: Accept
  maxSize?: number
  multiple?: boolean
  message?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const { classes, cx } = useStyles()
  const inputRef = useRef<HTMLInputElement>(null)
  // dragenter/dragleave fire for child elements too; ref-count them so
  // isDragActive does not flicker as the cursor moves over inner content
  const dragDepthRef = useRef(0)
  const [isDragActive, setIsDragActive] = useState(false)

  function handleFiles(fileList: FileList | null) {
    const files = fileList ? [...fileList] : []
    const chosen = multiple ? files : files.slice(0, 1)
    const accepted: File[] = []
    const rejected: FileRejection[] = []
    for (const file of chosen) {
      const errors = validate(file, accept, maxSize)
      if (errors.length > 0) {
        rejected.push({ file, errors })
      } else {
        accepted.push(file)
      }
    }
    onDrop(accepted, rejected)
  }

  function openBrowse() {
    inputRef.current?.click()
  }

  const acceptAttr = accept
    ? Object.entries(accept)
        .flatMap(([mime, exts]) => [mime, ...exts])
        .join(',')
    : undefined

  return (
    <div
      role="button"
      tabIndex={0}
      className={cx(
        classes.dropZone,
        isDragActive ? classes.dropZoneActive : classes.dropZoneInactive,
        className,
      )}
      onClick={openBrowse}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openBrowse()
        }
      }}
      onDragEnter={(event: DragEvent) => {
        event.preventDefault()
        dragDepthRef.current += 1
        setIsDragActive(true)
      }}
      onDragOver={(event: DragEvent) => {
        event.preventDefault()
      }}
      onDragLeave={(event: DragEvent) => {
        event.preventDefault()
        dragDepthRef.current -= 1
        if (dragDepthRef.current <= 0) {
          dragDepthRef.current = 0
          setIsDragActive(false)
        }
      }}
      onDrop={(event: DragEvent) => {
        event.preventDefault()
        dragDepthRef.current = 0
        setIsDragActive(false)
        handleFiles(event.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={event => {
          handleFiles(event.target.files)
          // reset so selecting the same file again still fires onChange
          event.target.value = ''
        }}
      />
      <CloudUploadIcon className={classes.uploadIcon} fontSize="large" />
      <Typography color="text.secondary" align="center">
        {message ?? 'Drag and drop files here, or click to browse'}
      </Typography>
      {children}
    </div>
  )
}

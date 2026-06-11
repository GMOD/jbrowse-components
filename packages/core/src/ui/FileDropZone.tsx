import type { ReactNode } from 'react'

import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { Typography, alpha } from '@mui/material'
import { useDropzone } from 'react-dropzone'

import { makeStyles } from '../util/tss-react/index.ts'

import type { Accept, FileRejection } from 'react-dropzone'

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

/**
 * Shared dashed-border file dropzone (drag-and-drop plus click-to-browse) used
 * by the bulk add-track, multi-wiggle, assembly, and session-import forms. The
 * `onDrop` signature mirrors react-dropzone so callers can inspect rejected
 * files. Pass `message` to replace the default prompt and `children` for extra
 * content (e.g. a Browse button).
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
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxSize,
    multiple,
    onDrop,
  })
  return (
    <div
      {...getRootProps({
        className: cx(
          classes.dropZone,
          isDragActive ? classes.dropZoneActive : classes.dropZoneInactive,
          className,
        ),
      })}
    >
      <input {...getInputProps()} />
      <CloudUploadIcon className={classes.uploadIcon} fontSize="large" />
      <Typography color="text.secondary" align="center">
        {message ?? 'Drag and drop files here, or click to browse'}
      </Typography>
      {children}
    </div>
  )
}

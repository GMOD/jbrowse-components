import { Button } from '@mui/material'

import type { ButtonProps } from '@mui/material'

const { webUtils } = window.require('electron')

export default function OpenLocalFileButton({
  accept,
  onPick,
  children,
  ...rest
}: {
  accept: string
  onPick: (path: string) => void
  children: React.ReactNode
} & ButtonProps) {
  return (
    <Button component="label" {...rest}>
      {children}
      <input
        type="file"
        hidden
        accept={accept}
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) {
            onPick(webUtils.getPathForFile(file))
          }
        }}
      />
    </Button>
  )
}

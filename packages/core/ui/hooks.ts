import { useId, useState } from 'react'

export interface PopupState {
  open: (event?: React.MouseEvent | React.FocusEvent) => void
  close: () => void
  isOpen: boolean
  anchorEl: Element | undefined
  popupId: string
}

export function usePopupState(): PopupState {
  const popupId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<Element>()

  const open = (event?: React.MouseEvent | React.FocusEvent) => {
    if (event?.currentTarget) {
      setAnchorEl(event.currentTarget as Element)
    }
    setIsOpen(true)
  }

  const close = () => {
    setIsOpen(false)
  }

  return { isOpen, anchorEl, popupId, open, close }
}

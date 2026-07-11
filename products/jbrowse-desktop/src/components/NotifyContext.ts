import { createContext, use } from 'react'

export interface NotifyAction {
  label: string
  onClick: () => void
}

export type NotifyError = (error: unknown, action?: NotifyAction) => void

export const NotifyContext = createContext<NotifyError | undefined>(undefined)

export function useNotifyError() {
  const notifyError = use(NotifyContext)
  if (!notifyError) {
    throw new Error('useNotifyError must be used within a NotificationProvider')
  }
  return notifyError
}

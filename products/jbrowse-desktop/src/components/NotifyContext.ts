import { createContext, use } from 'react'

export const NotifyContext = createContext<
  ((error: unknown) => void) | undefined
>(undefined)

export function useNotifyError() {
  const notifyError = use(NotifyContext)
  if (!notifyError) {
    throw new Error('useNotifyError must be used within a NotificationProvider')
  }
  return notifyError
}

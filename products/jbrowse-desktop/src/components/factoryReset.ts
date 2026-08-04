import { invokeIpc } from '../ipc.ts'

export default async function factoryReset() {
  await invokeIpc('reset')
  window.location.reload()
}

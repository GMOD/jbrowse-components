import { invokeIpc } from '../ipc.ts'
import { clearGlobalPluginLoadMarker } from './StartScreen/globalPlugins.ts'

export default async function factoryReset() {
  await invokeIpc('reset')
  // the reset just emptied the global plugin list; a marker left from the
  // crash that brought the user here would blame plugins that no longer exist
  clearGlobalPluginLoadMarker()
  window.location.reload()
}

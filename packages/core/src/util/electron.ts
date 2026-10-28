import type { ElectronMainChannels } from './electronChannels.ts'

interface ElectronRenderer {
  ipcRenderer: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
    on(
      channel: string,
      listener: (event: unknown, ...args: unknown[]) => void,
    ): void
    off(
      channel: string,
      listener: (event: unknown, ...args: unknown[]) => void,
    ): void
  }
  webUtils: { getPathForFile(file: File): string }
}

/**
 * #api core/util
 * The renderer half of `electron`, reached through the Node `require` an
 * Electron window runs with. Throws outside Electron.
 */
export function electronRenderer() {
  const { require } = window as unknown as {
    require?: (module: 'electron') => ElectronRenderer
  }
  if (!require) {
    throw new Error('not running in Electron')
  }
  return require('electron')
}

/**
 * #api core/util
 * Calls an Electron main-process handler, checked against
 * {@link ElectronMainChannels}.
 */
export async function invokeElectronMain<K extends keyof ElectronMainChannels>(
  channel: K,
  ...args: ElectronMainChannels[K]['args']
) {
  return (await electronRenderer().ipcRenderer.invoke(
    channel,
    ...args,
  )) as ElectronMainChannels[K]['return']
}

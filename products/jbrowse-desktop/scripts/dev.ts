import { spawn } from 'child_process'
import { createRequire } from 'module'

import desktopConfig from './config.ts'
import configFactory from '../../../webpack/config/webpack.config.ts'
import startServer from '../../../webpack/scripts/start.ts'

const url = await startServer(desktopConfig(configFactory()))

// bundle electron/ to build/electron.js, same as the `preelectron` hook does
await import('./buildElectronMain.ts')

// electron's own launcher, which finds the platform binary and forwards
// signals/exit codes to it
const electronCli = createRequire(import.meta.url).resolve('electron/cli.js')

// DEV_SERVER_URL carries the port the server actually bound to; electron's
// window.ts otherwise falls back to :3000, which is wrong whenever 3000 was
// taken and webpack picked a port for itself
const electron = spawn(process.execPath, [electronCli, '.', '--no-sandbox'], {
  stdio: 'inherit',
  env: { ...process.env, DEV_SERVER_URL: url },
})

// the dev server holds this process open, so closing the window has to end it
electron.on('close', code => {
  process.exit(code ?? 0)
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    electron.kill(signal)
  })
}

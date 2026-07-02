// Bridge to the jbrowse-desktop main process. BLAT requests are routed through
// the main process for two reasons: the renderer is CORS-bound like a browser
// (so a direct cross-origin hgBlat call fails), and the cf_clearance cookie
// from a solved Cloudflare Turnstile challenge (held in the default session)
// attaches first-party there. A user-supplied apiKey avoids the challenge; the
// solve-window path is the fallback when there's no key.

interface IpcRenderer {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
}

// window.require('electron') is the desktop preload bridge; typed narrowly here
// rather than polluting the global Window type from a plugin
function getIpcRenderer() {
  const req = (window as unknown as { require?: (m: string) => unknown })
    .require
  if (!req) {
    throw new Error('electron ipcRenderer unavailable')
  }
  return (req('electron') as { ipcRenderer: IpcRenderer }).ipcRenderer
}

export async function desktopBlatFetch({
  url,
  body,
}: {
  url: string
  body: string
}) {
  return (await getIpcRenderer().invoke('blatFetch', url, body)) as {
    ok: boolean
    status: number
    text: string
  }
}

export async function openBlatChallenge(url: string) {
  return (await getIpcRenderer().invoke('openBlatChallenge', url)) as boolean
}

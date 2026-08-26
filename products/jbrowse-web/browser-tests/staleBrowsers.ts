import path from 'node:path'

export interface PsProc {
  pid: number
  ppid: number
  comm: string
  argv: string[]
}

// `ps -eo pid=,ppid=,comm=,args=`
export function parsePsTable(psOut: string): PsProc[] {
  return psOut
    .split('\n')
    .map(line => /^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line.trim()))
    .filter(m => m !== null)
    .map(m => ({
      pid: +m[1]!,
      ppid: +m[2]!,
      comm: m[3]!,
      argv: m[4]!.split(/\s+/),
    }))
}

// A puppeteer browser's MAIN process: chromium-family, carrying puppeteer's
// `--enable-automation` token (the user's own Chrome never has it), and no
// `--type=`. Chrome forwards the token to every renderer, and a renderer's
// parent is the zygote rather than the launcher, so a renderer can never say
// whether its run is alive.
function isTestBrowserMain(p: PsProc) {
  return (
    /^(chrome|chromium|headless_shell)/.test(p.comm) &&
    p.argv.includes('--enable-automation') &&
    !p.argv.some(a => a.startsWith('--type='))
  )
}

// Test browsers whose launching `node` is gone. A live run keeps `node` as the
// browser's parent; an orphan has been reparented to init or a subreaper
// (`systemd --user` on this desktop), which is what `parentExe` distinguishes.
//
// The parent is identified by its executable, never by `ps`'s `comm`: Node 24
// names its main thread `MainThread`, which is what `comm` then reports, and a
// `comm !== 'node'` test reaped every live puppeteer browser on the machine
// each time a runner started.
export function staleTestBrowsers(
  procs: PsProc[],
  parentExe: (ppid: number) => string | undefined,
) {
  return procs.filter(
    p =>
      isTestBrowserMain(p) && path.basename(parentExe(p.ppid) ?? '') !== 'node',
  )
}

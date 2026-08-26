import { parsePsTable, staleTestBrowsers } from './staleBrowsers.ts'

const NODE = '/home/x/.fnm/node-versions/v24.13.0/installation/bin/node'
const CHROME = '/opt/google/chrome/chrome'

const ps = `
      1       0 systemd         /usr/lib/systemd/systemd --system
   5929       1 systemd         /usr/lib/systemd/systemd --user
 100000    5000 MainThread      node probe.ts
 100001  100000 chrome          ${CHROME} --enable-automation --headless=new --remote-debugging-pipe
 100002  100001 chrome          ${CHROME} --type=zygote --enable-automation
 100003  100002 chrome          ${CHROME} --type=renderer --enable-automation --field-trial-handle=3
 200000    5000 node            node browser-tests/runner.ts
 200001  200000 chrome          ${CHROME} --enable-automation --headless=new
 300001    5929 chrome          ${CHROME} --enable-automation --headless=new
 400001    5000 chrome          ${CHROME} --headless=new --user-data-dir=/home/x/.config/google-chrome
`

const exes = new Map<number, string>([
  [1, '/usr/lib/systemd/systemd'],
  [5929, '/usr/lib/systemd/systemd'],
  [100000, NODE],
  [200000, NODE],
  [100001, CHROME],
  [100002, CHROME],
])
const parentExe = (pid: number) => exes.get(pid)

test('a browser under a live node 24 launcher is not stale, though ps calls that node MainThread', () => {
  const stale = staleTestBrowsers(parsePsTable(ps), parentExe)
  expect(stale.map(p => p.pid)).toEqual([300001])
})

test('renderers and zygotes are never candidates, whatever their parent', () => {
  const procs = parsePsTable(ps).map(p =>
    p.pid === 100002 || p.pid === 100003 ? { ...p, ppid: 5929 } : p,
  )
  expect(staleTestBrowsers(procs, parentExe).map(p => p.pid)).toEqual([300001])
})

test('a parent that has already gone reads as no launcher', () => {
  const procs = parsePsTable(ps).filter(p => p.pid === 200001)
  expect(staleTestBrowsers(procs, () => undefined).map(p => p.pid)).toEqual([
    200001,
  ])
})

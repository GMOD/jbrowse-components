/* eslint-disable no-console */
// One-off probe: how long a track menu takes to open, to open each submenu on
// hover, and to answer a checkbox click, in the built app.
//
//   node products/jbrowse-web/browser-tests/probe-menu-latency.ts
//
// TRACKS=id1,id2 picks the menus and REPS the repetitions. TRACE=1 adds the
// renderer's main-thread time per hover, split into script, style, layout and
// paint. PROFILE=1 writes a source-mapped CPU profile summary of the hover loop
// (PROFILE_OPEN=1: of opening and closing the menu) to OUT. THROTTLE=4 slows
// the CPU, which is what makes a difference visible: unthrottled, every build
// shows a submenu two frames after the hover, because Chrome dispatches mouse
// events on frame boundaries. Compare builds by alternating runs, and read the
// TRACE column, which is thread time and so survives a loaded machine better
// than latency does.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { createFrameResolver } from './frameResolver.ts'
import { delay, setPort, waitForDataLoaded } from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TRACKS = (
  process.env.TRACKS || 'volvox_alignments,volvox_filtered_vcf,gff3tabix_genes'
).split(',')
const REPS = Number(process.env.REPS || 5)
const PROFILE = !!process.env.PROFILE
const OUT = process.env.OUT

const { server, port } = await startServerOnFreePort(3500)
setPort(port)

const browser = await launch({
  headless: true,
  args: [...BASE_CHROME_ARGS, '--window-size=1400,1000'],
  defaultViewport: { width: 1400, height: 1000 },
})

interface Sample {
  kind: string
  label: string
  // event timestamp → DOM mutation that shows the result
  toDom: number
  // event timestamp → the frame after that mutation
  toFrame: number
  // Event Timing duration of the triggering event(s), max
  eventDuration: number
}

const samples: Sample[] = []

async function installObservers(page: Page) {
  await page.evaluate(() => {
    const w = window as any
    w.__eventEntries = []
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        w.__eventEntries.push({
          name: e.name,
          startTime: e.startTime,
          duration: e.duration,
          processing: (e as any).processingEnd - (e as any).processingStart,
        })
      }
    }).observe({ type: 'event', durationThreshold: 0, buffered: false } as any)
    w.__loaf = []
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        w.__loaf.push({ startTime: e.startTime, duration: e.duration })
      }
    }).observe({ type: 'long-animation-frame', buffered: false })
    w.__lastEvent = 0
    for (const type of ['pointerover', 'mouseover', 'pointerdown', 'click']) {
      document.addEventListener(
        type,
        (e: Event) => {
          if (!w.__lastEvent) {
            w.__lastEvent = e.timeStamp
          }
        },
        { capture: true },
      )
    }
  })
}

// Resolves in-page once `ready()` holds after some mutation, with the event
// timestamp, the mutation time, and the time of the frame that followed.
function armWait(page: Page, readyFn: string) {
  return page.evaluate((src: string) => {
    const w = window as any
    // eslint-disable-next-line no-implied-eval -- the predicate crosses into the page as source
    const ready = new Function(`return (${src})()`) as () => boolean
    w.__eventEntries.length = 0
    w.__lastEvent = 0
    w.__result = new Promise(resolve => {
      const mo = new MutationObserver(() => {
        if (ready()) {
          mo.disconnect()
          const tDom = performance.now()
          requestAnimationFrame(() => {
            const tFrame = performance.now()
            setTimeout(() => {
              resolve({ tEvent: w.__lastEvent, tDom, tFrame })
            }, 50)
          })
        }
      })
      mo.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      })
    })
  }, readyFn)
}

async function collect(page: Page, kind: string, label: string) {
  const r = (await page.evaluate(() =>
    Promise.race([
      (window as any).__result,
      new Promise(r =>
        setTimeout(() => {
          r(null)
        }, 5000),
      ),
    ]),
  )) as { tEvent: number; tDom: number; tFrame: number } | null
  if (!r) {
    console.log(`  TIMEOUT ${kind} ${label}`)
    return
  }
  const entries = (await page.evaluate(
    () => (window as any).__eventEntries,
  )) as { name: string; duration: number }[]
  samples.push({
    kind,
    label,
    toDom: r.tDom - r.tEvent,
    toFrame: r.tFrame - r.tEvent,
    eventDuration: Math.max(0, ...entries.map(e => e.duration)),
  })
}

async function openTrackMenu(page: Page, trackId: string) {
  const btn = await page.$(
    `[data-testid="track_menu_icon"][data-trackid="${trackId}"]`,
  )
  if (!btn) {
    throw new Error(`no menu button for ${trackId}`)
  }
  const box = (await btn.boundingBox())!
  await armWait(
    page,
    `() => document.querySelectorAll('[role="menu"]').length > 0`,
  )
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await collect(page, 'open', trackId)
}

async function closeAll(page: Page) {
  for (let i = 0; i < 4; i++) {
    const n = await page.evaluate(
      () => document.querySelectorAll('[role="menu"]').length,
    )
    if (n === 0) {
      return
    }
    await page.keyboard.press('Escape')
    await delay(80)
  }
}

async function rootSubmenuRows(page: Page) {
  return page.evaluate(() => {
    const menus = [...document.querySelectorAll('[role="menu"]')]
    const root = menus[0]!
    return [
      ...root.querySelectorAll(':scope > [data-testid^="cascading-submenu-"]'),
    ].map(el => {
      const r = el.getBoundingClientRect()
      return {
        testid: el.dataset.testid!,
        x: r.left + 24,
        y: (r.top + r.bottom) / 2,
      }
    })
  })
}

async function hoverSubmenus(page: Page, trackId: string) {
  const rows = await rootSubmenuRows(page)
  for (const row of rows) {
    await armWait(
      page,
      `() => document.querySelector('[data-testid="${row.testid}"]')?.getAttribute('aria-expanded') === 'true' && document.querySelectorAll('[role="menu"]').length >= 2`,
    )
    await page.mouse.move(row.x, row.y)
    await collect(page, 'hover-submenu', `${trackId} ${row.testid}`)
    await delay(100)
  }
  return rows
}

// Open the first submenu that holds a checkbox row and click it twice.
async function toggleCheckbox(page: Page, trackId: string) {
  const rows = await rootSubmenuRows(page)
  for (const row of rows) {
    await page.mouse.move(row.x, row.y)
    await delay(150)
    const target = await page.evaluate(() => {
      const menus = [...document.querySelectorAll('[role="menu"]')]
      const sub = menus.at(-1)!
      const cb = sub.querySelector('[role="menuitemcheckbox"]')
      if (menus.length < 2 || !cb) {
        return undefined
      }
      const r = cb.getBoundingClientRect()
      return {
        testid: cb.dataset.testid,
        x: r.left + 30,
        y: (r.top + r.bottom) / 2,
      }
    })
    if (!target?.testid) {
      continue
    }
    // travel into the panel along the row, the way a pointer would
    await page.mouse.move(target.x, row.y, { steps: 8 })
    await page.mouse.move(target.x, target.y, { steps: 4 })
    await delay(150)
    for (let i = 0; i < 2; i++) {
      const before = await page.evaluate(
        (id: string) =>
          document
            .querySelector(`[data-testid="${CSS.escape(id)}"]`)
            ?.getAttribute('aria-checked'),
        target.testid,
      )
      await armWait(
        page,
        `() => document.querySelector('[data-testid="${target.testid}"]')?.getAttribute('aria-checked') !== ${JSON.stringify(before)}`,
      )
      await page.mouse.click(target.x, target.y)
      await collect(page, 'toggle-checkbox', `${trackId} ${target.testid}`)
      await delay(300)
    }
    return
  }
}

async function profileHovers(page: Page, trackId: string) {
  const cdp = await page.createCDPSession()
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 })
  if (process.env.PROFILE_OPEN) {
    await cdp.send('Profiler.start')
    for (let i = 0; i < 10; i++) {
      await openTrackMenu(page, trackId)
      await delay(150)
      await closeAll(page)
      await delay(150)
    }
  } else {
    await openTrackMenu(page, trackId)
    await delay(300)
    await cdp.send('Profiler.start')
    for (let i = 0; i < 3; i++) {
      await hoverSubmenus(page, trackId)
    }
  }
  const { profile } = await cdp.send('Profiler.stop')
  await closeAll(page)
  const { resolve } = createFrameResolver()
  const nodes = new Map<number, any>()
  const parent = new Map<number, number>()
  for (const n of profile.nodes) {
    nodes.set(n.id, n)
    for (const c of n.children || []) {
      parent.set(c, n.id)
    }
  }
  const labelOf = new Map<number, string>()
  for (const n of profile.nodes) {
    labelOf.set(n.id, await resolve(n.callFrame))
  }
  const self = new Map<string, number>()
  const incl = new Map<string, number>()
  const bucket = new Map<string, number>()
  let busy = 0
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i]
    const dt = profile.timeDeltas[i] || 0
    const fn = nodes.get(id)?.callFrame.functionName
    if (fn === '(idle)' || fn === '(program)') {
      continue
    }
    busy += dt
    const label = labelOf.get(id)!
    self.set(label, (self.get(label) || 0) + dt)
    const src = /\[(.*?):\d+\]/.exec(label)?.[1] || label
    const b = src.startsWith('~/')
      ? src
          .split('/')
          .slice(1, src.split('/')[1]!.startsWith('@') ? 3 : 2)
          .join('/')
      : src.includes('packages/') || src.includes('plugins/')
        ? src.split('/').slice(0, 2).join('/')
        : src
    bucket.set(b, (bucket.get(b) || 0) + dt)
    const seen = new Set<string>()
    for (
      let cur: number | undefined = id;
      cur !== undefined;
      cur = parent.get(cur)
    ) {
      const l = labelOf.get(cur)!
      if (!seen.has(l)) {
        seen.add(l)
        incl.set(l, (incl.get(l) || 0) + dt)
      }
    }
  }
  const lines: string[] = []
  const fmt = (m: Map<string, number>, n: number) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([l, us]) => `${(us / 1000).toFixed(1).padStart(8)} ms  ${l}`)
  lines.push(`busy ${(busy / 1000).toFixed(0)} ms`, '--- by package (self)')
  lines.push(...fmt(bucket, 25), '--- self', ...fmt(self, 50))
  lines.push(
    '--- inclusive, our ui code',
    ...fmt(
      new Map(
        [...incl].filter(([l]) =>
          /packages\/core\/src\/ui|plugins\/|MenuItems|mobx|\bobserver|renderWithHooks|commitRoot|performWorkOnRoot|dispatchDiscreteEvent|flushSync/.test(
            l,
          ),
        ),
      ),
      40,
    ),
  )
  const out = OUT || path.join(__dirname, 'menu-profile.txt')
  fs.writeFileSync(out, lines.join('\n'))
  console.log(`profile summary → ${out}`)
}

// Main-thread time per hover, split into script vs. the rendering pipeline,
// from a devtools timeline trace of the hover loop.
async function traceHovers(page: Page, trackId: string) {
  const file = path.join(
    process.env.TRACE_DIR || __dirname,
    'menu-hover-trace.json',
  )
  await openTrackMenu(page, trackId)
  samples.pop()
  await delay(300)
  await page.tracing.start({
    path: file,
    categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'],
  })
  let hovers = 0
  for (let i = 0; i < 3; i++) {
    hovers += (await hoverSubmenus(page, trackId)).length
    for (let j = 0; j < (await rootSubmenuRows(page)).length; j++) {
      samples.pop()
    }
  }
  await page.tracing.stop()
  await closeAll(page)
  const events = JSON.parse(fs.readFileSync(file, 'utf8')).traceEvents as any[]
  // the busiest renderer main thread: the trace also holds idle renderers
  const mains = events.filter(
    e => e.name === 'thread_name' && e.args?.name === 'CrRendererMain',
  )
  const onMain = mains
    .map(m =>
      events.filter(e => e.ph === 'X' && e.tid === m.tid && e.pid === m.pid),
    )
    .sort((a, b) => b.length - a.length)[0]!
  // thread time, not wall time, so a loaded machine descheduling the renderer
  // doesn't read as work
  const sum = (names: string[]) =>
    onMain
      .filter(e => names.includes(e.name))
      .reduce((a, e) => a + (e.tdur ?? e.dur ?? 0), 0) / 1000
  const tasks = sum(['RunTask'])
  const style = sum(['UpdateLayoutTree'])
  const layout = sum(['Layout'])
  const paint = sum(['Paint', 'PrePaint', 'Layerize', 'Commit'])
  const gc = sum([
    'MinorGC',
    'MajorGC',
    'V8.GC_SCAVENGER',
    'BlinkGC.AtomicPhase',
  ])
  const per = (x: number) => (x / hovers).toFixed(1)
  console.log(
    `\ntrace ${trackId}: ${hovers} hovers; per hover — tasks ${per(tasks)} ms, style ${per(style)}, layout ${per(layout)}, paint ${per(paint)}, gc ${per(gc)}, script+other ${per(tasks - style - layout - paint)}`,
  )
}

function median(xs: number[]) {
  const s = xs.toSorted((a, b) => a - b)
  return s[Math.floor(s.length / 2)] ?? Number.NaN
}

try {
  const page = await browser.newPage()
  page.on('pageerror', e => {
    console.log(`PAGE ERROR: ${e instanceof Error ? e.message : String(e)}`)
  })
  const spec = {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1000-6000',
        tracks: TRACKS,
      },
    ],
  }
  await page.goto(
    `http://localhost:${port}/?config=test_data/volvox/config.json&session=${encodeSessionSpec(spec)}&sessionName=Perf&renderer=canvas2d`,
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  )
  await page.waitForSelector('[data-testid="track_menu_icon"]', {
    timeout: 60000,
  })
  await waitForDataLoaded(page, 60000).catch(() => {})
  await delay(1500)
  await installObservers(page)
  if (process.env.THROTTLE) {
    const cdp = await page.createCDPSession()
    await cdp.send('Emulation.setCPUThrottlingRate', {
      rate: Number(process.env.THROTTLE),
    })
  }

  for (const trackId of TRACKS) {
    const counts = await (async () => {
      await openTrackMenu(page, trackId)
      samples.pop()
      const c = await page.evaluate(() => {
        const root = document.querySelector('[role="menu"]')!
        return {
          rows: root.querySelectorAll(':scope > li').length,
          submenus: root.querySelectorAll(
            ':scope > [data-testid^="cascading-submenu-"]',
          ).length,
          popoverRoots: document.querySelectorAll('.MuiPopover-root').length,
        }
      })
      await closeAll(page)
      return c
    })()
    console.log(`${trackId}: ${JSON.stringify(counts)}`)
    for (let rep = 0; rep < REPS; rep++) {
      await openTrackMenu(page, trackId)
      await delay(200)
      await hoverSubmenus(page, trackId)
      await closeAll(page)
      await delay(200)
    }
    await openTrackMenu(page, trackId)
    samples.pop()
    await delay(200)
    for (let rep = 0; rep < Math.max(1, Math.floor(REPS / 2)); rep++) {
      await toggleCheckbox(page, trackId)
    }
    await closeAll(page)
    await delay(300)
  }

  const groups = new Map<string, Sample[]>()
  for (const s of samples) {
    const key = process.env.PER_ROW
      ? `${s.kind} ${s.label}`
      : `${s.kind} ${s.kind === 'hover-submenu' ? s.label.split(' ')[0] : s.label}`
    groups.set(key, [...(groups.get(key) || []), s])
  }
  console.log(
    `\n${'interaction'.padEnd(52)}${'n'.padStart(4)}${'toDom'.padStart(
      8,
    )}${'toFrame'.padStart(9)}${'evtDur'.padStart(8)}`,
  )
  for (const [k, ss] of groups) {
    console.log(
      k.padEnd(52) +
        String(ss.length).padStart(4) +
        median(ss.map(s => s.toDom))
          .toFixed(1)
          .padStart(8) +
        median(ss.map(s => s.toFrame))
          .toFixed(1)
          .padStart(9) +
        median(ss.map(s => s.eventDuration))
          .toFixed(0)
          .padStart(8),
    )
  }
  const loaf = (await page.evaluate(() => (window as any).__loaf)) as {
    duration: number
  }[]
  console.log(
    `\nlong animation frames: ${loaf.length}, median ${median(loaf.map(l => l.duration)).toFixed(0)} ms, max ${Math.max(0, ...loaf.map(l => l.duration)).toFixed(0)} ms`,
  )
  if (PROFILE) {
    await profileHovers(page, TRACKS[0]!)
  }
  if (process.env.TRACE) {
    for (const trackId of TRACKS) {
      await traceHovers(page, trackId)
    }
  }
} finally {
  await browser.close()
  server.close()
}

// One JBrowse capture per candidate, driven against the portal's own static
// copy of the app so the pictures and the links show the same thing.
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

// In this repo the capture tool is a sibling product rather than a dependency;
// gene-review-portal, which is where this pipeline lives outside the monorepo,
// resolves the same bin out of @jbrowse/capture instead.
export function captureBin() {
  return path.resolve(
    import.meta.dirname,
    '../../../products/jbrowse-capture/src/bin.ts',
  )
}

export function sessionFor(candidate, trackIds, assembly, padFraction = 0.15) {
  const pad = Math.max(2000, Math.round((candidate.end - candidate.start) * padFraction))
  const start = Math.max(1, candidate.start - pad)
  const end = candidate.end + pad
  return {
    loc: `${candidate.refName}:${start}-${end}`,
    session: {
      views: [
        {
          type: 'LinearGenomeView',
          assembly,
          loc: `${candidate.refName}:${start}-${end}`,
          tracks: trackIds,
        },
      ],
    },
  }
}

// Relative so the published directory works from any host: the app sits in
// jbrowse/ and reads the config one level up.
export function relativeLink(session, appDir = 'jbrowse') {
  const spec = encodeURIComponent(`spec-${JSON.stringify(session)}`)
  return `${appDir}/?config=../config.json&session=${spec}`
}

// Apollo is a JBrowse plugin, so an Apollo deployment takes the same session
// spec — minus the config, which is the Apollo server's own, and minus the
// tracks: Apollo adds `apollo_track_<assembly>` once its assemblies have loaded
// and then re-applies its own snapshot, so a spec naming that track is racing
// the code that creates it.
export function apolloLink(session, instance) {
  const spec = encodeURIComponent(`spec-${JSON.stringify(session)}`)
  const sep = instance.endsWith('/') ? '' : '/'
  return `${instance}${sep}?session=${spec}`
}

export function absoluteLink(session, instance, configUrl) {
  const spec = encodeURIComponent(`spec-${JSON.stringify(session)}`)
  const sep = instance.endsWith('/') ? '' : '/'
  return `${instance}${sep}?config=${encodeURIComponent(configUrl)}&session=${spec}`
}

// spawn, not execFileSync: the portal serves its own data from an http server
// in THIS process, and a synchronous child blocks the event loop, so the server
// never answers Chromium and every capture dies on a navigation timeout.
function runCapture(args, timeout) {
  return new Promise(resolve => {
    const child = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let err = ''
    child.stderr.on('data', d => (err += d))
    child.stdout.on('data', () => {})
    const kill = setTimeout(() => child.kill('SIGKILL'), timeout * 4)
    child.on('close', code => {
      clearTimeout(kill)
      resolve({ ok: code === 0, err: err.trim() })
    })
    child.on('error', e => {
      clearTimeout(kill)
      resolve({ ok: false, err: e.message })
    })
  })
}

// A failed capture costs its card the picture and nothing else: the run carries
// on and the page says so. That is the right call for a locus that genuinely
// will not draw, and the wrong one for a flake — Chromium drops a "detached
// Frame" often enough that an unretried build ships a hole. So each candidate
// gets a second attempt, and only a locus that fails twice is reported.
export async function captureAll({ candidates, trackIds, assembly, instance, configUrl, outDir, captureBin, width, height, scale, settle, timeout, attempts = 2, onProgress }) {
  fs.mkdirSync(outDir, { recursive: true })
  const results = []
  for (const c of candidates) {
    const { session } = sessionFor(c, trackIds, assembly)
    const specPath = path.join(outDir, `.${c.id}.session.json`)
    const out = path.join(outDir, `${c.id}.png`)
    fs.writeFileSync(specPath, JSON.stringify(session))
    let ok = false
    let err = ''
    let tries = 0
    while (!ok && tries < attempts) {
      tries++
      ;({ ok, err } = await runCapture(
        [
          captureBin,
          '--instance', instance,
          '--config', configUrl,
          '--session', specPath,
          '--width', String(width),
          '--height', String(height),
          '--scale', String(scale),
          '--settle', String(settle),
          '--timeout', String(timeout),
          '-o', out,
        ],
        timeout,
      ))
    }
    const note = ok ? '' : err.split('\n').slice(-2).join(' ').slice(0, 300)
    fs.unlinkSync(specPath)
    results.push({ id: c.id, ok, note, tries, file: ok ? path.basename(out) : null })
    onProgress?.(c, ok, note, tries)
  }
  return results
}

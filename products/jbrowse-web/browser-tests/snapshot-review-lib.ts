import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  hashFile,
  loadReport as loadReportFile,
  saveReport as saveReportFile,
} from '@jbrowse/browser-test-utils'

import { comparePngBuffers } from './pngDiff.ts'

import type { Verdict } from '@jbrowse/browser-test-utils'

export type { Verdict } from '@jbrowse/browser-test-utils'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const snapshotsDir = path.resolve(__dirname, '__snapshots__')
export const reportPath = path.resolve(__dirname, 'snapshot-review.json')

// The rendering backends each get their own snapshot subdirectory. Order is the
// reference-first priority used when picking the image shown in the basic-pass
// view: canvas2d is the deterministic software reference, so it leads.
export const BACKENDS = ['canvas2d', 'webgl', 'webgpu'] as const
export type Backend = (typeof BACKENDS)[number]

function backendDir(backend: Backend) {
  return path.join(snapshotsDir, backend)
}

// SVG exports and a handful of legacy PNGs live at the snapshots root rather
// than under a backend dir; they're backend-independent.
function readDirFiles(dir: string) {
  return fs.existsSync(dir)
    ? new Set(
        fs
          .readdirSync(dir)
          .filter(
            f => /\.(png|svg)$/.test(f) && !/\.diff(-visual)?\.png$/.test(f),
          ),
      )
    : new Set<string>()
}

// One reviewable snapshot, identified by its file name. `backends` lists which
// backend dirs contain it; `inRoot` flags the backend-independent root copy
// (SVG exports always, plus a few legacy PNGs). `kind` drives grouping in the
// UI (targeted canvas vs full-page vs svg export).
export interface SnapshotEntry {
  name: string
  kind: 'targeted' | 'fullpage' | 'svg' | 'other'
  isSvg: boolean
  backends: Backend[]
  inRoot: boolean
}

function classify(name: string): SnapshotEntry['kind'] {
  return name.endsWith('.svg')
    ? 'svg'
    : name.startsWith('targeted_')
      ? 'targeted'
      : name.startsWith('fullpage_')
        ? 'fullpage'
        : 'other'
}

// The full reviewable set: the union of every file across the root and the
// three backend dirs, one entry per distinct file name.
export function collectSnapshots(): SnapshotEntry[] {
  const rootFiles = readDirFiles(snapshotsDir)
  const perBackend = new Map<Backend, Set<string>>(
    BACKENDS.map(b => [b, readDirFiles(backendDir(b))]),
  )
  const names = new Set<string>([
    ...rootFiles,
    ...BACKENDS.flatMap(b => [...perBackend.get(b)!]),
  ])
  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({
      name,
      kind: classify(name),
      isSvg: name.endsWith('.svg'),
      backends: BACKENDS.filter(b => perBackend.get(b)!.has(name)),
      inRoot: rootFiles.has(name),
    }))
}

// Absolute path to a snapshot file for a backend, or the root copy when
// `backend` is undefined. Guards against path traversal — a name escaping the
// snapshots tree returns undefined.
export function snapshotPath(
  name: string,
  backend?: Backend,
): string | undefined {
  const dir = backend ? backendDir(backend) : snapshotsDir
  const full = path.resolve(dir, name)
  return full.startsWith(dir + path.sep) ? full : undefined
}

// The image a basic-pass verdict applies to: canvas2d (the deterministic
// reference) when present, else the first available backend, else the root
// copy. Mirrors the client's reference-picking so the hash tracks exactly what
// the reviewer saw and approved.
export function referenceLocation(
  entry: SnapshotEntry,
): Backend | 'root' | undefined {
  return entry.backends.includes('canvas2d')
    ? 'canvas2d'
    : (entry.backends[0] ?? (entry.inRoot ? 'root' : undefined))
}

export function referenceHash(entry: SnapshotEntry): string | undefined {
  const loc = referenceLocation(entry)
  const full = loc && snapshotPath(entry.name, loc === 'root' ? undefined : loc)
  return full ? hashFile(full) : undefined
}

export function referenceHashByName(name: string): string | undefined {
  const entry = collectSnapshots().find(s => s.name === name)
  return entry ? referenceHash(entry) : undefined
}

export interface BackendDiff {
  a: Backend
  b: Backend
  // undefined when one side is missing the file
  diffFraction?: number
  sameSize?: boolean
  reason?: string
}

// Pairwise drift between every backend that has this snapshot. Computed on
// demand (PNG decode is not cheap) and never for SVGs.
export function compareBackends(name: string): BackendDiff[] {
  const out: BackendDiff[] = []
  for (let i = 0; i < BACKENDS.length; i++) {
    for (let j = i + 1; j < BACKENDS.length; j++) {
      const a = BACKENDS[i]!
      const b = BACKENDS[j]!
      const pathA = snapshotPath(name, a)
      const pathB = snapshotPath(name, b)
      const hasA = pathA && fs.existsSync(pathA)
      const hasB = pathB && fs.existsSync(pathB)
      if (hasA && hasB) {
        const diff = comparePngBuffers(
          fs.readFileSync(pathA),
          fs.readFileSync(pathB),
        )
        out.push({
          a,
          b,
          diffFraction: diff.diffFraction,
          sameSize: diff.sameSize,
        })
      } else {
        out.push({
          a,
          b,
          reason: `missing in ${[!hasA && a, !hasB && b].filter(Boolean).join(' & ')}`,
        })
      }
    }
  }
  return out
}

// Visual diff PNG between two backends for a snapshot, or undefined if either
// side is absent.
export function diffImage(
  name: string,
  a: Backend,
  b: Backend,
): Buffer | undefined {
  const pathA = snapshotPath(name, a)
  const pathB = snapshotPath(name, b)
  if (pathA && pathB && fs.existsSync(pathA) && fs.existsSync(pathB)) {
    return comparePngBuffers(fs.readFileSync(pathA), fs.readFileSync(pathB))
      .diffImage
  }
  return undefined
}

export function loadReport(): Record<string, Verdict> {
  return loadReportFile(reportPath)
}

export function saveReport(report: Record<string, Verdict>) {
  saveReportFile(reportPath, report)
}

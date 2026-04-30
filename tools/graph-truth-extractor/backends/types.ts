export type TruthBackend = 'vg' | 'odgi' | 'chunkix' | 'naive'

export interface ExtractRequest {
  gfaPath: string
  pathName: string
  start: number
  end: number
  context: number | 'snarl'
  backend: TruthBackend
  // Optional: prefix for index-style backends (chunkix). If unspecified the
  // backend may build indexes lazily under <gfaPath>.truth-cache/.
  indexPrefix?: string
  // Optional: directory to keep build artifacts (.xg, .gbz, .og,
  // chunkix tabix files). Defaults to `<gfaPath>.truth-cache/`.
  cacheDir?: string
}

export interface ExtractResult {
  gfa: string
  segmentCount: number
  edgeCount: number
  pathCount: number
  elapsedMs: number
  backendVersion: string
  // Free-form diagnostic info specific to the backend (e.g. command line).
  notes?: string
}

export interface BackendDeps {
  // Pinned external tool versions surface as preconditions for CI; the
  // harness throws with a clear message if the local install is older.
  expectedVgVersion?: string
  expectedOdgiVersion?: string
  // Path to the sequencetubemap checkout root (contains scripts/chunkix.py).
  sequencetubemapDir?: string
}

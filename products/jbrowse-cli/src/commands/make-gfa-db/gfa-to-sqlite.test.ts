import fs from 'fs'
import os from 'os'
import path from 'path'

import { DatabaseSync } from 'node:sqlite'

import { createGfaDatabase, populateFromGfa } from './gfa-to-sqlite.ts'

const GFA_FILE = path.resolve(
  'test/data/synteny-demo/synthetic/synthetic_4genome.gfa',
)

async function withTempDb(fn: (dbPath: string) => Promise<void>) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfa-db-test-'))
  const dbPath = path.join(tmpDir, 'test.db')
  try {
    await fn(dbPath)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

describe('GFA to SQLite conversion', () => {
  it('creates database with correct schema', async () => {
    await withTempDb(async dbPath => {
      const db = createGfaDatabase(dbPath)
      const stats = await populateFromGfa(db, GFA_FILE)
      db.close()

      expect(stats.segmentCount).toBeGreaterThan(0)
      expect(stats.pathCount).toBeGreaterThan(0)
      expect(stats.genomes.length).toBe(4)

      const readDb = new DatabaseSync(dbPath)

      const segCount = readDb
        .prepare('SELECT COUNT(*) as cnt FROM segments')
        .get() as { cnt: number }
      expect(segCount.cnt).toBe(stats.segmentCount)

      const pathCount = readDb
        .prepare('SELECT COUNT(*) as cnt FROM paths')
        .get() as { cnt: number }
      expect(pathCount.cnt).toBe(stats.pathCount)

      const stepCount = readDb
        .prepare('SELECT COUNT(*) as cnt FROM path_steps')
        .get() as { cnt: number }
      expect(stepCount.cnt).toBeGreaterThan(0)

      readDb.close()
    })
  })

  it('stores segments with correct lengths', async () => {
    await withTempDb(async dbPath => {
      const db = createGfaDatabase(dbPath)
      await populateFromGfa(db, GFA_FILE)

      const seg = db.prepare('SELECT * FROM segments WHERE id = ?').get('s0') as {
        id: string
        length: number
      }
      expect(seg).toBeDefined()
      expect(seg.id).toBe('s0')
      expect(seg.length).toBe(43452)

      db.close()
    })
  })

  it('stores paths with genome info', async () => {
    await withTempDb(async dbPath => {
      const db = createGfaDatabase(dbPath)
      await populateFromGfa(db, GFA_FILE)

      const paths = db
        .prepare('SELECT * FROM paths ORDER BY name')
        .all() as { name: string; sample: string; sequence: string; total_length: number }[]
      expect(paths.length).toBe(4)
      expect(paths.map(p => p.sample).sort()).toEqual(
        ['ref#1', 'sample1#1', 'sample2#1', 'sample3#1'].sort(),
      )

      for (const p of paths) {
        expect(p.total_length).toBeGreaterThan(0)
      }

      db.close()
    })
  })

  it('stores path steps with cumulative offsets', async () => {
    await withTempDb(async dbPath => {
      const db = createGfaDatabase(dbPath)
      await populateFromGfa(db, GFA_FILE)

      const refPath = db
        .prepare("SELECT id FROM paths WHERE sample = 'ref#1'")
        .get() as { id: number }
      const steps = db
        .prepare(
          'SELECT * FROM path_steps WHERE path_id = ? ORDER BY step_index',
        )
        .all(refPath.id) as {
        step_index: number
        segment_id: string
        orientation: string
        cumulative_offset: number
        segment_length: number
      }[]

      expect(steps.length).toBe(200)
      expect(steps[0]!.cumulative_offset).toBe(0)
      expect(steps[0]!.segment_id).toBe('s0')
      expect(steps[0]!.orientation).toBe('+')

      // Verify cumulative offsets are monotonically increasing
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i]!.cumulative_offset).toBeGreaterThan(
          steps[i - 1]!.cumulative_offset,
        )
        expect(steps[i]!.cumulative_offset).toBe(
          steps[i - 1]!.cumulative_offset + steps[i - 1]!.segment_length,
        )
      }

      db.close()
    })
  })

  it('can query steps by offset range', async () => {
    await withTempDb(async dbPath => {
      const db = createGfaDatabase(dbPath)
      await populateFromGfa(db, GFA_FILE)

      const refPath = db
        .prepare("SELECT id FROM paths WHERE sample = 'ref#1'")
        .get() as { id: number }

      // Query for steps overlapping region [10000, 100000]
      const steps = db
        .prepare(
          `SELECT * FROM path_steps
           WHERE path_id = ?
             AND cumulative_offset + segment_length > ?
             AND cumulative_offset < ?
           ORDER BY step_index`,
        )
        .all(refPath.id, 10000, 100000) as {
        segment_id: string
        cumulative_offset: number
        segment_length: number
      }[]

      expect(steps.length).toBeGreaterThan(0)
      for (const step of steps) {
        const stepEnd = step.cumulative_offset + step.segment_length
        expect(stepEnd).toBeGreaterThan(10000)
        expect(step.cumulative_offset).toBeLessThan(100000)
      }

      db.close()
    })
  })

  it('can find shared segments between genomes', async () => {
    await withTempDb(async dbPath => {
      const db = createGfaDatabase(dbPath)
      await populateFromGfa(db, GFA_FILE)

      // Find segments shared between ref and sample1
      const shared = db
        .prepare(
          `SELECT ps1.segment_id, ps1.cumulative_offset as ref_offset,
                  ps2.cumulative_offset as sample_offset,
                  ps1.segment_length
           FROM path_steps ps1
           JOIN path_steps ps2 ON ps1.segment_id = ps2.segment_id
           JOIN paths p1 ON ps1.path_id = p1.id
           JOIN paths p2 ON ps2.path_id = p2.id
           WHERE p1.sample = 'ref#1' AND p2.sample = 'sample1#1'
           ORDER BY ps1.cumulative_offset
           LIMIT 10`,
        )
        .all() as {
        segment_id: string
        ref_offset: number
        sample_offset: number
        segment_length: number
      }[]

      expect(shared.length).toBeGreaterThan(0)
      expect(shared[0]!.segment_id).toBe('s0')
      expect(shared[0]!.ref_offset).toBe(0)
      expect(shared[0]!.sample_offset).toBe(0)

      db.close()
    })
  })

  it('filters by assemblies when specified', async () => {
    await withTempDb(async dbPath => {
      const db = createGfaDatabase(dbPath)
      const stats = await populateFromGfa(db, GFA_FILE, ['ref#1', 'sample1#1'])
      expect(stats.genomes.length).toBe(2)
      expect(stats.pathCount).toBe(2)

      const pathCount = db
        .prepare('SELECT COUNT(*) as cnt FROM paths')
        .get() as { cnt: number }
      expect(pathCount.cnt).toBe(2)

      db.close()
    })
  })
})

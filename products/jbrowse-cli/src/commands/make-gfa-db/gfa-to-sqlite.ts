import { DatabaseSync } from 'node:sqlite'

import { getReadline } from '../make-pif/file-utils.ts'

interface PathStep {
  segId: string
  orient: string
}

interface PathInfo {
  sample: string
  haplotype: string
  sequence: string
  steps: PathStep[]
}

export function createGfaDatabase(dbPath: string) {
  const db = new DatabaseSync(dbPath)

  db.exec(`
    CREATE TABLE segments (
      id TEXT PRIMARY KEY,
      length INTEGER NOT NULL,
      sn TEXT,
      so INTEGER,
      sr INTEGER
    );

    CREATE TABLE paths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sample TEXT NOT NULL,
      haplotype TEXT NOT NULL,
      sequence TEXT NOT NULL,
      total_length INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE path_steps (
      path_id INTEGER NOT NULL,
      step_index INTEGER NOT NULL,
      segment_id TEXT NOT NULL,
      orientation TEXT NOT NULL,
      cumulative_offset INTEGER NOT NULL,
      segment_length INTEGER NOT NULL,
      PRIMARY KEY (path_id, step_index),
      FOREIGN KEY (path_id) REFERENCES paths(id),
      FOREIGN KEY (segment_id) REFERENCES segments(id)
    );

    CREATE INDEX idx_path_steps_offset ON path_steps(path_id, cumulative_offset);
    CREATE INDEX idx_path_steps_segment ON path_steps(segment_id);
    CREATE INDEX idx_paths_sample ON paths(sample);
  `)

  return db
}

interface SegmentInfo {
  name: string
  length: number
  sn: string | null
  so: number | null
  sr: number | null
}

export async function populateFromGfa(
  db: DatabaseSync,
  gfaPath: string,
  assemblies?: string[],
) {
  const rl = getReadline(gfaPath)

  const segmentList: SegmentInfo[] = []
  const segmentLengths = new Map<string, number>()
  const allPaths: PathInfo[] = []

  for await (const line of rl) {
    if (line.startsWith('S\t')) {
      const parts = line.split('\t')
      const name = parts[1]!
      const seq = parts[2]!
      const seqLen = seq === '*' ? 0 : seq.length
      const lnTag = parts.slice(3).find(t => t.startsWith('LN:i:'))
      const snTag = parts.slice(3).find(t => t.startsWith('SN:'))
      const soTag = parts.slice(3).find(t => t.startsWith('SO:i:'))
      const srTag = parts.slice(3).find(t => t.startsWith('SR:i:'))
      const length = lnTag ? +lnTag.slice(5) : seqLen

      segmentLengths.set(name, length)
      segmentList.push({
        name,
        length,
        sn: snTag ? snTag.slice(5) : null,
        so: soTag ? +soTag.slice(5) : null,
        sr: srTag ? +srTag.slice(5) : null,
      })
    } else if (line.startsWith('W\t')) {
      const parts = line.split('\t')
      const sample = parts[1]!
      const haplotype = parts[2]!
      const sequence = parts[3]!
      const walkStr = parts[6]!

      if (assemblies && !assemblies.includes(`${sample}#${haplotype}`)) {
        continue
      }

      const steps: PathStep[] = []
      const stepRegex = /([><])([^><]+)/g
      let match: RegExpExecArray | null = null
      while ((match = stepRegex.exec(walkStr)) !== null) {
        steps.push({
          segId: match[2]!,
          orient: match[1] === '>' ? '+' : '-',
        })
      }
      allPaths.push({
        sample: `${sample}#${haplotype}`,
        haplotype,
        sequence,
        steps,
      })
    } else if (line.startsWith('P\t')) {
      const parts = line.split('\t')
      const pathName = parts[1]!
      const steps: PathStep[] = parts[2]!.split(',').map(s => ({
        segId: s.endsWith('+') || s.endsWith('-') ? s.slice(0, -1) : s,
        orient: s.endsWith('-') ? '-' : '+',
      }))

      const hashIdx = pathName.lastIndexOf('#')
      const sample = hashIdx > 0 ? pathName.slice(0, hashIdx) : pathName
      const sequence = hashIdx > 0 ? pathName.slice(hashIdx + 1) : pathName

      if (assemblies && !assemblies.includes(sample)) {
        continue
      }

      allPaths.push({ sample, haplotype: '0', sequence, steps })
    }
  }
  rl.close()

  // Batch insert all data after parsing is complete
  const insertSeg = db.prepare(
    'INSERT OR IGNORE INTO segments (id, length, sn, so, sr) VALUES (?, ?, ?, ?, ?)',
  )
  const insertPath = db.prepare(
    'INSERT INTO paths (name, sample, haplotype, sequence, total_length) VALUES (?, ?, ?, ?, ?)',
  )
  const insertStep = db.prepare(
    'INSERT INTO path_steps (path_id, step_index, segment_id, orientation, cumulative_offset, segment_length) VALUES (?, ?, ?, ?, ?, ?)',
  )

  db.exec('BEGIN TRANSACTION')

  for (const seg of segmentList) {
    insertSeg.run(seg.name, seg.length, seg.sn, seg.so, seg.sr)
  }

  for (const p of allPaths) {
    let totalLength = 0
    for (const step of p.steps) {
      totalLength += segmentLengths.get(step.segId) ?? 0
    }

    const pathName = `${p.sample}#${p.sequence}`
    const result = insertPath.run(
      pathName,
      p.sample,
      p.haplotype,
      p.sequence,
      totalLength,
    )
    const pathId = result.lastInsertRowid

    let offset = 0
    for (let i = 0; i < p.steps.length; i++) {
      const step = p.steps[i]!
      const segLen = segmentLengths.get(step.segId) ?? 0
      insertStep.run(pathId, i, step.segId, step.orient, offset, segLen)
      offset += segLen
    }
  }
  db.exec('COMMIT')

  return {
    segmentCount: segmentLengths.size,
    pathCount: allPaths.length,
    genomes: [...new Set(allPaths.map(p => p.sample))],
  }
}

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { REGIONS, configTracks, hasR, track } from './exportView.fixture.ts'
import { exportTracksToR, rKey } from './exportView.ts'

describe('exporting a view of tracks to one R script', () => {
  const marks = configTracks('config_marks.json')
  const main = configTracks('config.json')

  it('keys R names from track ids, past a leading digit', () => {
    expect(rKey('1000g_cnv')).toBe('x1000g_cnv')
    expect(rKey('volvox-sv.renamed')).toBe('volvox_sv_renamed')
  })

  it('names what it leaves out in the script header', () => {
    const { script, notes, drawn } = exportTracksToR({
      regions: REGIONS,
      tracks: [
        track(marks, 'marks_line_posneg', 'LinearMarkDisplay', {
          ...marks.get('marks_line_posneg')!.displays![0]!,
        }),
        track(marks, 'marks_rows', 'LinearMarkDisplay', {
          ...marks.get('marks_rows')!.displays![0]!,
        }),
        track(main, 'volvox_alignments', 'LinearArcDisplay', {}),
      ],
    })
    expect(drawn).toBe(1)
    expect(notes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('MultiWiggleAdapter has no R reader'),
        expect.stringContaining('LinearArcDisplay has no R export'),
      ]),
    )
    expect(script).toContain('MultiWiggleAdapter has no R reader')
  })

  it('draws nothing, and says so, when no track reads', () => {
    const { script, notes } = exportTracksToR({
      regions: REGIONS,
      tracks: [track(main, 'volvox_alignments', 'LinearArcDisplay', {})],
    })
    expect(script).toBeUndefined()
    expect(notes).toHaveLength(1)
  })

  const maybe = hasR() ? it : it.skip
  maybe(
    'runs under Rscript as one figure across display kinds',
    () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'rexport-view-'))
      const png = path.join(dir, 'view.png')
      const { script, drawn } = exportTracksToR({
        regions: REGIONS,
        out: png,
        tracks: [
          track(main, 'gff3tabix_genes', 'LinearBasicDisplay', {}),
          track(main, 'volvox_alignments', 'LinearAlignmentsDisplay', {
            color: { field: 'strand' },
          }),
          track(
            main,
            'volvox_alignments_grouped_by_strand',
            'LinearAlignmentsDisplay',
            {
              color: { field: 'mapq' },
            },
          ),
          track(marks, 'marks_line_posneg', 'LinearMarkDisplay', {
            ...marks.get('marks_line_posneg')!.displays![0]!,
          }),
        ],
      })
      expect(drawn).toBe(8)
      const file = path.join(dir, 'view.R')
      writeFileSync(file, script!)
      execFileSync('Rscript', [file], { stdio: 'pipe' })
      expect(existsSync(png)).toBe(true)
    },
    180_000,
  )

  maybe(
    'reads a file under the name it spells a contig with',
    () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'rexport-alias-'))
      const refNames = { chrA: 'ctgA' }
      const { script } = exportTracksToR({
        regions: [{ refName: 'chrA', start: 1000, end: 6000 }],
        out: path.join(dir, 'alias.png'),
        tracks: [
          {
            ...track(main, 'gff3tabix_genes', 'LinearBasicDisplay', {}),
            refNames,
          },
          {
            ...track(main, 'volvox_alignments', 'LinearAlignmentsDisplay', {}),
            refNames,
          },
        ],
      })
      const file = path.join(dir, 'alias.R')
      writeFileSync(file, script!)
      const out = execFileSync(
        'Rscript',
        [
          '-e',
          `e <- new.env(); source("${file}", local = e); cat(nrow(e$genes_gff3tabix_genes$features) > 0, nrow(e$aln_volvox_alignments$reads) > 0)`,
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      )
      expect(out.trimEnd().endsWith('TRUE TRUE')).toBe(true)
    },
    180_000,
  )
})

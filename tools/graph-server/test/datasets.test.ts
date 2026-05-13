import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { parsePanSN } from '../src/datasets.ts'

test('parsePanSN — 2-part name (vg reference path, no subwalk)', () => {
  const r = parsePanSN('GRCh38#chr20', 64444167)
  assert.equal(r.genome, 'GRCh38')
  assert.equal(r.refName, 'chr20')
  assert.equal(r.subwalkStart, 0)
  assert.equal(r.subwalkEnd, 64444167)
})

test('parsePanSN — 3-part name (odgi PanSN, no subwalk)', () => {
  const r = parsePanSN('CHM13#0#chr20', 100)
  assert.equal(r.genome, 'CHM13#0')
  assert.equal(r.refName, 'chr20')
  assert.equal(r.subwalkStart, 0)
  assert.equal(r.subwalkEnd, 100)
})

test('parsePanSN — 4-part name (vg haplotype, fragment index dropped)', () => {
  // vg emits `sample#hap#contig#fragment` for fragmented haplotype assemblies;
  // the trailing `#0` is a vg-internal split key, not part of the assembly id.
  const r = parsePanSN('HG00438#1#JAHBCB010000074.1#0', 200000)
  assert.equal(r.genome, 'HG00438#1')
  assert.equal(r.refName, 'JAHBCB010000074.1')
})

test('parsePanSN — colon-style subwalk suffix (odgi convention)', () => {
  const r = parsePanSN('CHM13#0#chr20:100864-26386516')
  assert.equal(r.genome, 'CHM13#0')
  assert.equal(r.refName, 'chr20')
  assert.equal(r.subwalkStart, 100864)
  assert.equal(r.subwalkEnd, 26386516)
})

test('parsePanSN — bracket-style subwalk suffix (vg convention)', () => {
  const r = parsePanSN('CHM13#chr20[100864-26386516]')
  assert.equal(r.genome, 'CHM13')
  assert.equal(r.refName, 'chr20')
  assert.equal(r.subwalkStart, 100864)
  assert.equal(r.subwalkEnd, 26386516)
})

test('parsePanSN — 4-part name with bracket subwalk', () => {
  const r = parsePanSN('HG00438#1#JAHBCB010000074.1#0[32519992-32715703]')
  assert.equal(r.genome, 'HG00438#1')
  assert.equal(r.refName, 'JAHBCB010000074.1')
  assert.equal(r.subwalkStart, 32519992)
  assert.equal(r.subwalkEnd, 32715703)
})

test('parsePanSN — bare name (no `#`) returns name in both fields', () => {
  const r = parsePanSN('ctgA', 50001)
  assert.equal(r.genome, 'ctgA')
  assert.equal(r.refName, 'ctgA')
  assert.equal(r.subwalkEnd, 50001)
})

import { cleanup } from '@testing-library/react'

import { doBeforeEach, setup, testLinkedReadsDisplay } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

afterEach(() => {
  cleanup()
})

const timeout = 60000

const testStack = (loc: string, track: string) =>
  testLinkedReadsDisplay({
    loc,
    track,
    displayMode: 'stack',
    canvasId: 'stack-canvas',
    timeout,
  })

test('short-read stack display', async () => {
  await testStack('ctgA:1-50000', 'volvox_sv_cram')
}, timeout)

test('long-read stack display', async () => {
  await testStack('ctgA:19,101..32,027', 'volvox-simple-inv.bam')
}, timeout)

test('long-read stack display, out of view pairing', async () => {
  await testStack('ctgA:478..6,191', 'volvox-long-reads-sv-cram')
}, timeout)

test('short-read stack display, out of view pairing', async () => {
  await testStack('ctgA:478..6,191', 'volvox_sv_cram')
}, timeout)

test('short-read stack display at ctgA:33,623..35,216', async () => {
  await testStack('ctgA:33,623..35,216', 'volvox_sv_cram')
}, timeout)

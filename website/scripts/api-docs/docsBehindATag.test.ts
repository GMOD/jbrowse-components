import fs from 'fs'
import os from 'os'
import path from 'path'

import { createDocProgram, extractWithComment } from './util.ts'

// TypeScript splits a JSDoc block at its first `@tag`, so a docstring that opens
// with `@deprecated` hands the generator an empty comment and files the prose
// under `tags`, where nothing reads it. The member still publishes — with a
// blank Description cell, on every page that inherits it. Three members reached
// the site that way before anyone noticed, each of them the one row saying a
// deprecated name still resolves and what to call instead.
//
// Driven through a real `ts.Program`, like delegatedBlocks.test.ts: what is
// under test is which half of the JSDoc TypeScript's parser puts the sentence
// in, and a hand-built comment string would be asserting on itself.

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb-behind-tag-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function extract(source: string) {
  const file = path.join(dir, 'model.ts')
  fs.writeFileSync(
    file,
    `/**
      * #stateModel WidgetModel
      */
     export function WidgetModel() {
       return types.model({}).views(() => ({
         ${source}
       }))
     }`,
  )
  extractWithComment(
    createDocProgram([file]),
    () => {},
    () => {},
  )
}

test('a member whose prose all sits after an @tag is fatal', () => {
  expect(() =>
    extract(`/**
       * #getter
       * @deprecated prefer \`height\`, which resolves the sentinel.
       */
      get rowHeight() {
        return 1
      },`),
  ).toThrow(/rowHeight/)
})

// The narrowing that keeps this off the 2,887 members nobody has documented:
// no prose and no tag text is a backlog entry, not a sentence the page ate.
test('a member with no prose at all is not', () => {
  expect(() =>
    extract(`/**
       * #getter
       */
      get rowHeight() {
        return 1
      },`),
  ).not.toThrow()
})

test('a member that leads with prose and ends on a bare tag is not', () => {
  expect(() =>
    extract(`/**
       * #getter
       * Deprecated alias of \`height\`. Call that.
       *
       * @deprecated
       */
      get rowHeight() {
        return 1
      },`),
  ).not.toThrow()
})

// The prose is what the generator publishes, so a trailing @param carrying the
// only other words is not this bug.
test('prose plus a documented @param is not', () => {
  expect(() =>
    extract(`/**
       * #method
       * Resolve a row height for the given track.
       * @param trackId the track to resolve for
       */
      rowHeightFor(trackId: string) {
        return trackId.length
      },`),
  ).not.toThrow()
})

/**
 * @jest-environment node
 */

import { test } from '@oclif/test'

describe('hello', () => {
  test
    .stdout()
    .command(['hello'])
    .it('runs hello', ctx => {
      expect(ctx.stdout).toMatch('hello world')
    })

  test
    .stdout()
    .command(['hello', '--name', 'jeff'])
    .it('runs hello --name jeff', ctx => {
      expect(ctx.stdout).toMatch('hello jeff')
    })
})

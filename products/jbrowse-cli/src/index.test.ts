/**
 * @jest-environment node
 */

import { runCommand } from './testUtil.ts'

test('lists every command in the global help', async () => {
  const { stdout } = await runCommand(['--help'])
  expect(stdout).toContain('JBrowse CLI')
  for (const name of ['create', 'add-assembly', 'add-track', 'text-index']) {
    expect(stdout).toContain(name)
  }
})

test('prints the version', async () => {
  const { stdout } = await runCommand(['--version'])
  expect(stdout).toMatch(/@jbrowse\/cli version \d+\.\d+\.\d+/)
})

// the command args are sliced from the command token, which drops a help flag
// written ahead of it — `jbrowse --help create` used to run create with no args
// and fail on the missing positional
test.each([
  ['--help', 'create'],
  ['-h', 'add-track'],
])('%s before a command shows that command help', async (flag, command) => {
  const { stdout, error } = await runCommand([flag, command])
  expect(error).toBeUndefined()
  expect(stdout).toContain(`Usage: jbrowse ${command}`)
})

test('reports an unknown command', async () => {
  const { error } = await runCommand(['nonexistent-command'])
  expect(error?.message).toContain('Unknown command "nonexistent-command"')
})

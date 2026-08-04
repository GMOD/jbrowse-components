import fs from 'node:fs'

import { readTextInput } from './util.ts'

// `readTextInput` remembers that stdin was consumed, so the sequence matters:
// these assertions run in one test rather than several that would share (and
// fight over) that module-level state.
test('"-" reads stdin exactly once; any other value is a file path', () => {
  const readFileSync = jest
    .spyOn(fs, 'readFileSync')
    .mockReturnValue('{"from":"the mock"}')

  expect(readTextInput('some/file.json')).toBe('{"from":"the mock"}')
  expect(readFileSync).toHaveBeenLastCalledWith('some/file.json', 'utf8')

  // fd 0 is stdin
  expect(readTextInput('-')).toBe('{"from":"the mock"}')
  expect(readFileSync).toHaveBeenLastCalledWith(0, 'utf8')

  // a second read of fd 0 would return nothing, which would surface as a
  // baffling JSON parse error rather than the mistake it is
  expect(() => readTextInput('-')).toThrow(/can only be read once/)

  readFileSync.mockRestore()
})

import copyToClipboard from './copyToClipboard.ts'

function setup({
  writeText,
  execCommand,
}: {
  writeText: () => Promise<void>
  execCommand: () => boolean
}) {
  Object.defineProperty(window, 'isSecureContext', {
    value: true,
    configurable: true,
  })
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  Object.defineProperty(document, 'execCommand', {
    value: jest.fn(execCommand),
    configurable: true,
  })
}

test('falls back to execCommand when writeText rejects', async () => {
  setup({
    writeText: () => Promise.reject(new Error('denied')),
    execCommand: () => true,
  })
  await expect(copyToClipboard('hello')).resolves.toBeUndefined()
  expect(document.execCommand).toHaveBeenCalledWith('copy')
})

test('rethrows the writeText error when the fallback fails too', async () => {
  setup({
    writeText: () => Promise.reject(new Error('denied')),
    execCommand: () => false,
  })
  await expect(copyToClipboard('hello')).rejects.toThrow('denied')
})

test('skips execCommand when writeText succeeds', async () => {
  setup({ writeText: () => Promise.resolve(), execCommand: () => true })
  await copyToClipboard('hello')
  expect(document.execCommand).not.toHaveBeenCalled()
})

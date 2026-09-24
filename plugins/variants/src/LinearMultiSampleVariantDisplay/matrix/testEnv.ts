import { createTestEnvironment as createDisplayTestEnvironment } from '../testEnv.ts'

export function createTestEnvironment({
  displayConfig,
}: { displayConfig?: Record<string, unknown> } = {}) {
  return createDisplayTestEnvironment({
    displayConfig: { variantLayout: 'columns', ...displayConfig },
  })
}

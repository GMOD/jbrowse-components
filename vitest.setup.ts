import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('./packages/core/util/idMaker', () => ({
  default: () => 'test',
}))

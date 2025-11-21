import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    deps: {
      inline: ['@mui/x-data-grid'],
    },
  },
})

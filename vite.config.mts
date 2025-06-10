import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
    deps: {
      inline: ['@mui/x-data-grid'],
    },
  },
})

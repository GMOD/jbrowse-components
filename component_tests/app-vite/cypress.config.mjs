import { defineConfig } from 'cypress'

export default defineConfig({
  chromeWebSecurity: false,
  video: false,
  e2e: {
    baseUrl: 'http://localhost:5000',
  },
})

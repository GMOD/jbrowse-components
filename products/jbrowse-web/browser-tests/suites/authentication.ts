import {
  clearStorageAndNavigate,
  findByText,
  handleBasicAuthLogin,
  handleOAuthLogin,
  navigateToApp,
  openTrack,
  waitForDisplay,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'

const webWorkerAuth: TestSuite = {
  name: 'Authentication (WebWorker RPC)',
  requiresAuth: true,
  tests: [
    {
      name: 'loads with auth config',
      fn: async page => {
        await navigateToApp(page, 'test_data/volvox/config_auth.json')
        await findByText(page, 'Help', 10000)
      },
    },
    {
      name: 'loads OAuth BigWig track after login',
      fn: async (page, browser) => {
        await navigateToApp(page, 'test_data/volvox/config_auth.json')
        await openTrack(page, 'oauth_bigwig')
        await handleOAuthLogin(browser!)
        await waitForDisplay(page, 'oauth_bigwig')
      },
    },
    {
      name: 'loads BasicAuth BigWig track after login',
      fn: async page => {
        await navigateToApp(page, 'test_data/volvox/config_auth.json')
        await openTrack(page, 'basicauth_bigwig')
        await handleBasicAuthLogin(page)
        await waitForDisplay(page, 'basicauth_bigwig')
      },
    },
  ],
}

const mainThreadAuth: TestSuite = {
  name: 'Authentication (MainThread RPC)',
  requiresAuth: true,
  tests: [
    {
      name: 'loads with main thread auth config',
      fn: async page => {
        await navigateToApp(page, 'test_data/volvox/config_auth_main.json')
        await findByText(page, 'Help', 10000)
      },
    },
    {
      name: 'loads OAuth BigWig track after login (main thread)',
      fn: async (page, browser) => {
        await clearStorageAndNavigate(
          page,
          'test_data/volvox/config_auth_main.json',
        )
        await openTrack(page, 'oauth_bigwig')
        await handleOAuthLogin(browser!)
        await waitForDisplay(page, 'oauth_bigwig')
      },
    },
    {
      name: 'loads BasicAuth BigWig track after login (main thread)',
      fn: async page => {
        await clearStorageAndNavigate(
          page,
          'test_data/volvox/config_auth_main.json',
        )
        await openTrack(page, 'basicauth_bigwig')
        await handleBasicAuthLogin(page)
        await waitForDisplay(page, 'basicauth_bigwig')
      },
    },
  ],
}

export default [webWorkerAuth, mainThreadAuth]

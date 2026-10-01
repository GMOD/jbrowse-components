import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import puppeteer from 'puppeteer'

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
    {
      name: 'handles multiple BasicAuth credentials on same domain',
      fn: async page => {
        await clearStorageAndNavigate(page, 'test_data/volvox/config_auth.json')
        await openTrack(page, 'basicauth_bigwig_public')
        await handleBasicAuthLogin(page, 'alice', 'public123')
        await waitForDisplay(page, 'basicauth_bigwig_public')
        await openTrack(page, 'basicauth_bigwig_private')
        await handleBasicAuthLogin(page, 'bob', 'private456')
        await waitForDisplay(page, 'basicauth_bigwig_private')
      },
    },
    {
      // The harness browser runs without web security, which makes the
      // challenge a same-origin one: Chrome then raises its own credential
      // prompt and the request never settles. A user's browser keeps CORS on,
      // so this test runs in one that does.
      name: 'prompts for BasicAuth when no account covers a URL that challenges',
      fn: async () => {
        const browser = await puppeteer.launch({
          headless: true,
          args: BASE_CHROME_ARGS.filter(a => a !== '--disable-web-security'),
        })
        try {
          const page = await browser.newPage()
          await clearStorageAndNavigate(
            page,
            'test_data/volvox/config_auth.json',
          )
          await openTrack(page, 'basicauth_bigwig_challenge')
          await handleBasicAuthLogin(page, 'carol', 'challenge789')
          await waitForDisplay(page, 'basicauth_bigwig_challenge')
        } finally {
          await browser.close()
        }
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

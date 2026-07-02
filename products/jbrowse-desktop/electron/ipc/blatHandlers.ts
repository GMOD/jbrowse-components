import { net } from 'electron'

import { createChallengeWindow } from '../window.ts'
import { ipcHandle } from './channels.ts'

export function registerBlatHandlers() {
  ipcHandle('openBlatChallenge', (_, url) => createChallengeWindow(url))

  ipcHandle('blatFetch', async (_, url, body) => {
    // net.fetch uses the default session, and credentials:'include' attaches
    // its cookies (including any cf_clearance from a solved challenge) as a
    // first-party request to the BLAT host
    const response = await net.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      credentials: 'include',
    })
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text(),
    }
  })
}

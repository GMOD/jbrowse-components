import fs from 'node:fs'

import { ENCODING } from './paths.ts'

import type { RecentSession } from './ipc/channelTypes.ts'

/**
 * The recent-sessions list as it sits on disk, or the empty list.
 *
 * Here rather than beside its writers because the MCP bridge reads it too, and
 * its own copy of this had neither guard below: a corrupt file answered `open`
 * with "sessions.map is not a function", and an unreadable one was reported as
 * "no file yet".
 *
 * Unserialized, which the writers are not. Every write goes through
 * writeFileAtomic, so a reader sees the whole old file or the whole new one —
 * what the writers' queue protects is the read-modify-write in between, which
 * this is not part of.
 */
export async function readRecentSessions(
  recentSessionsPath: string,
): Promise<RecentSession[]> {
  try {
    const parsed: unknown = JSON.parse(
      await fs.promises.readFile(recentSessionsPath, ENCODING),
    )
    // A corrupt file that parses to a non-array (e.g. {}) must still yield the
    // empty-list contract; downstream .filter/.findIndex assume an array
    return Array.isArray(parsed) ? (parsed as RecentSession[]) : []
  } catch (e) {
    console.error(
      `Failed to load recent sessions file ${recentSessionsPath}: ${e}`,
    )
    return []
  }
}

/**
 * @jest-environment node
 */

import path from 'node:path'

import { isAutosave, isSessionFile } from './paths.ts'

import type { AppPaths } from './paths.ts'

// initializePaths is the only thing in the module that touches electron, and
// nothing here calls it
jest.mock('electron', () => ({ app: { getPath: jest.fn() } }))

// Only autosaveDir is read by what is tested here; the rest is filled so the
// literal is a real AppPaths rather than a cast.
function makePaths(root: string, sep: string): AppPaths {
  const join = (...parts: string[]) => [root, ...parts].join(sep)
  return {
    userData: root,
    recentSessionsPath: join('recent_sessions.json'),
    globalPluginsPath: join('globalPlugins.json'),
    quickstartDir: join('quickstart'),
    thumbnailDir: join('thumbnails'),
    faiDir: join('fai'),
    autosaveDir: join('autosaved'),
    jbrowseDocDir: join('JBrowse'),
    defaultSavePath: join('JBrowse', 'untitled.jbrowse'),
  }
}

function withPlatform(platform: string, fn: () => void) {
  const original = process.platform
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  })
  try {
    fn()
  } finally {
    Object.defineProperty(process, 'platform', {
      value: original,
      configurable: true,
    })
  }
}

describe('isAutosave (posix)', () => {
  const paths = makePaths('/home/u/.config/JBrowse', '/')

  test('a file in autosaveDir', () => {
    expect(isAutosave(paths, '/home/u/.config/JBrowse/autosaved/1.json')).toBe(
      true,
    )
  })

  test('the directory itself is not one of its files', () => {
    expect(isAutosave(paths, paths.autosaveDir)).toBe(false)
  })

  // The prefix-match failure with no separator boundary. Nothing creates this
  // directory today, which is exactly why a string prefix looked correct.
  test('a sibling directory sharing the prefix', () => {
    expect(
      isAutosave(paths, '/home/u/.config/JBrowse/autosaved-backup/1.json'),
    ).toBe(false)
  })

  test('a saved session elsewhere', () => {
    expect(isAutosave(paths, '/home/u/Documents/JBrowse/mine.jbrowse')).toBe(
      false,
    )
  })

  test('a path that climbs back out', () => {
    expect(
      isAutosave(paths, '/home/u/.config/JBrowse/autosaved/../other/1.json'),
    ).toBe(false)
  })

  test('posix is case-sensitive: a differently-cased dir is a different dir', () => {
    expect(isAutosave(paths, '/home/u/.config/JBrowse/AutoSaved/1.json')).toBe(
      false,
    )
  })
})

describe('isAutosave (win32)', () => {
  const root = String.raw`C:\Users\u\AppData\Roaming\JBrowse 2`
  const paths = makePaths(root, '\\')

  test('a file in autosaveDir', () => {
    withPlatform('win32', () => {
      expect(isAutosave(paths, `${paths.autosaveDir}\\1.json`)).toBe(true)
    })
  })

  // `path.resolve` in findLaunchTarget does not canonicalize case, so a session
  // opened by argv from a cmd prompt can carry a lowercase drive letter for the
  // very file `newAutosavePath` produced with an uppercase one. Reading that as
  // "not an autosave" makes loadSession mint a new path and fork the session.
  test('a drive letter cased differently is the same file', () => {
    withPlatform('win32', () => {
      expect(
        isAutosave(
          paths,
          String.raw`c:\users\u\appdata\roaming\jbrowse 2\autosaved\1.json`,
        ),
      ).toBe(true)
    })
  })

  test('a sibling directory sharing the prefix', () => {
    withPlatform('win32', () => {
      expect(isAutosave(paths, `${paths.autosaveDir}-backup\\1.json`)).toBe(
        false,
      )
    })
  })

  test('a file on another drive', () => {
    withPlatform('win32', () => {
      expect(isAutosave(paths, String.raw`D:\data\1.json`)).toBe(false)
    })
  })
})

describe('isSessionFile', () => {
  const paths = makePaths('/home/u/.config/JBrowse', '/')

  test('a saved session, anywhere', () => {
    expect(isSessionFile(paths, '/home/u/Documents/mine.jbrowse')).toBe(true)
  })

  test('an autosave, which is .json', () => {
    expect(
      isSessionFile(paths, path.posix.join(paths.autosaveDir, '1.json')),
    ).toBe(true)
  })

  // The distinction the whole predicate exists for: a config is read and never
  // written back over.
  test('a config.json the user brought', () => {
    expect(isSessionFile(paths, '/home/u/data/config.json')).toBe(false)
  })

  // Windows and macOS both match an extension without regard to case, so a
  // session can reach loadSession spelled this way — and reading it as "not a
  // session" is the expensive answer: loadSession mints a fresh autosave path
  // and the session forks away from the file the user opened.
  test('a saved session whose extension is cased differently', () => {
    expect(isSessionFile(paths, '/home/u/Documents/Mine.JBROWSE')).toBe(true)
  })
})

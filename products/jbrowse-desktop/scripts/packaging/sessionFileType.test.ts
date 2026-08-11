/**
 * @jest-environment node
 */

import { SESSION_EXTENSION } from '../../electron/launchTarget.ts'
import {
  SESSION_MIME_ICON_NAME,
  SESSION_MIME_TYPE,
  SESSION_UTI,
  macSessionDocumentType,
  sessionMimeXml,
} from './sessionFileType.ts'

// One extension, declared in four places that cannot see each other: argv
// parsing, the NSIS registry writes, an Info.plist, and a shared-mime-info
// glob. Nothing makes them agree except these tests — and the failure when they
// don't is not an error but an OS that quietly never launches the app, which is
// how `MimeType=application/x-jbrowse` sat in the .desktop file for years
// pointing at a type no glob ever matched.

describe('the macOS document type', () => {
  const info = () => macSessionDocumentType('JBrowse 2')

  // A CFBundleDocumentTypes entry can carry a bare CFBundleTypeExtensions list
  // instead — LaunchServices honours it — but then nothing on the system knows
  // what a .jbrowse file *is*: no type description in the Finder, and no way
  // for another application to say it opens one.
  test('exports a UTI and opens files of it, rather than naming a bare extension', () => {
    const [exported] = info().UTExportedTypeDeclarations
    expect(exported!.UTTypeIdentifier).toBe(SESSION_UTI)
    expect(info().CFBundleDocumentTypes[0]!.LSItemContentTypes).toEqual([
      SESSION_UTI,
    ])
    expect(JSON.stringify(info())).not.toContain('CFBundleTypeExtensions')
  })

  test('the exported type claims exactly the session extension, undotted', () => {
    expect(
      info().UTExportedTypeDeclarations[0]!.UTTypeTagSpecification[
        'public.filename-extension'
      ],
    ).toEqual([SESSION_EXTENSION.slice(1)])
  })

  // A session may be written back into the file it was opened from — that is
  // the whole distinction isSessionFile draws — so this is not a viewer. And we
  // define the type, so we outrank anyone who merely declares they read it.
  test('opens sessions as an editor, and owns the type', () => {
    const [doc] = info().CFBundleDocumentTypes
    expect(doc!.CFBundleTypeRole).toBe('Editor')
    expect(doc!.LSHandlerRank).toBe('Owner')
  })

  // The only icon in Contents/Resources is the one @electron/packager copies
  // under whatever name the prebuilt Electron's Info.plist used. Naming that
  // here would rot silently on an Electron upgrade; omitted, macOS composes a
  // document icon from the app icon, which is what we would have asked for.
  test('names no icon file', () => {
    expect(JSON.stringify(info())).not.toContain('CFBundleTypeIconFile')
  })
})

describe('the Linux mime package', () => {
  const xml = () => sessionMimeXml('JBrowse 2')

  // The piece the .desktop file's MimeType line has always assumed. `MimeType=`
  // says this application handles the type; only a glob says which files are of
  // it, and without one no session could ever match.
  test('globs the session extension onto the type the .desktop file claims', () => {
    expect(xml()).toContain(`<mime-type type="${SESSION_MIME_TYPE}">`)
    expect(xml()).toContain(`<glob pattern="*${SESSION_EXTENSION}"/>`)
  })

  // A session is JSON, so a desktop that knows only how to offer a text editor
  // still offers something rather than nothing.
  test('subclasses application/json', () => {
    expect(xml()).toContain('<sub-class-of type="application/json"/>')
  })

  test('is a well-formed shared-mime-info package', () => {
    expect(xml().startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
      true,
    )
    expect(xml()).toContain(
      '<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">',
    )
    expect(xml().split('<mime-type').length - 1).toBe(1)
  })

  // The icon basename *is* the lookup: freedesktop finds a type's icon by the
  // media type with its slash dashed, so the file linux.ts installs under this
  // name needs no <icon> element to be found.
  test('the icon name is the media type with its slash dashed', () => {
    expect(SESSION_MIME_ICON_NAME).toBe('application-x-jbrowse')
    expect(SESSION_MIME_ICON_NAME).toBe(SESSION_MIME_TYPE.replace('/', '-'))
  })
})

// A UTI is a permanent public name — other applications may come to declare
// they open one — so it must not quietly follow a rename of APP_ID. Pinned so
// that changing it takes deleting this line, which is the point at which
// someone has to think about the sessions already on disk.
test('the session UTI is stable', () => {
  expect(SESSION_UTI).toBe('org.jbrowse2.session')
})

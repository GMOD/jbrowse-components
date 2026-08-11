// The .jbrowse file association on the two platforms that declare it as data
// carried inside the bundle rather than as registry writes. Windows is
// nsisScript.ts.
//
// Pure, and its own module, for the reason nsisScript.ts is: packager.ts and
// linux.ts both reach config.ts, which reads `import.meta.dirname` and so cannot
// be loaded by jest's CJS transform.
//
// What is worth pinning here is that the several separate declarations of one
// extension agree — with each other and with SESSION_EXTENSION. They did not.
// The .desktop file has advertised `MimeType=application/x-jbrowse` since long
// before anything defined that type or tied it to `*.jbrowse`, so the line sat
// there looking like a registration and doing nothing at all.
//
// Neither output has a compile step to hide behind, the way the NSIS script has
// `pnpm check:nsis`, but both can be put in front of the tool that consumes them
// without building anything — worth doing if you change either:
//
//   - the mime package: write it into `<dir>/packages/`, copy
//     `/usr/share/mime/packages/freedesktop.org.xml` in beside it (it defines
//     the application/json we subclass), then `update-mime-database <dir>`. The
//     glob lands in `<dir>/globs2` as `application/x-jbrowse:*.jbrowse`.
//   - the Info.plist keys: `plist.build()` from the `plist` package (a
//     dependency of @electron/packager, which is what serializes them) turns
//     this object into the XML macOS reads.

import { SESSION_EXTENSION } from '../../electron/launchTarget.ts'

// Every declaration below wants the extension without its dot.
const ext = SESSION_EXTENSION.replace(/^\./, '')

/**
 * freedesktop media type for a saved session. `x-` because it is not
 * IANA-registered. Named here rather than invented: the .desktop file has
 * carried this exact string for years, and a rename would orphan whatever
 * desktop databases already recorded it.
 */
export const SESSION_MIME_TYPE = 'application/x-jbrowse'

/**
 * macOS Uniform Type Identifier for a saved session.
 *
 * Written out rather than derived from APP_ID on purpose. A UTI is a permanent
 * public name — other applications may come to declare that they open it — so
 * it must not quietly follow a rename of the bundle id. It shares APP_ID's
 * `org.jbrowse2` namespace by intent, not by construction.
 */
export const SESSION_UTI = 'org.jbrowse2.session'

/**
 * The icon basename freedesktop looks for when drawing a file of this type: the
 * media type with its slash turned into a dash. That naming *is* the lookup —
 * install the icon under this name and no `<icon>` element is needed.
 */
export const SESSION_MIME_ICON_NAME = SESSION_MIME_TYPE.replace('/', '-')

/**
 * Info.plist keys that make the Finder hand a `.jbrowse` file to us.
 *
 * Two halves, and both are needed. `UTExportedTypeDeclarations` *defines* the
 * type — we are the application that invented it, so we are the one that
 * exports it — and `CFBundleDocumentTypes` says this bundle opens it. A
 * `CFBundleDocumentTypes` entry alone can carry a bare `CFBundleTypeExtensions`
 * list, which is the pre-UTI form; LaunchServices still honours it, but nothing
 * else on the system then knows what a `.jbrowse` file *is*, so Finder has no
 * type description to show and no other application can declare it opens one.
 *
 * No `CFBundleTypeIconFile`. It names a file inside `Contents/Resources`, and
 * the only icon there is the one @electron/packager copies under whatever name
 * the prebuilt Electron's own Info.plist happened to use — hardcoding that here
 * would rot silently on an Electron upgrade. Omitted, macOS composes a document
 * icon from the app icon instead, which is the behaviour we would be asking for.
 */
export function macSessionDocumentType(productName: string) {
  const typeName = `${productName} Session`
  return {
    UTExportedTypeDeclarations: [
      {
        UTTypeIdentifier: SESSION_UTI,
        UTTypeDescription: typeName,
        // A session is JSON. public.json already conforms to public.text and
        // public.data, so anything that understands only those still handles the
        // file sensibly rather than treating it as an opaque blob.
        UTTypeConformsTo: ['public.json'],
        UTTypeTagSpecification: {
          'public.filename-extension': [ext],
        },
      },
    ],
    CFBundleDocumentTypes: [
      {
        CFBundleTypeName: typeName,
        LSItemContentTypes: [SESSION_UTI],
        // Editor rather than Viewer: a session opened from the Finder can be
        // written back into the same file. That is exactly what isSessionFile
        // decides, and the extension is how it decides it.
        CFBundleTypeRole: 'Editor',
        // We define the type, so we outrank any application that merely
        // declares it can also open one.
        LSHandlerRank: 'Owner',
      },
    ],
  }
}

/**
 * A shared-mime-info package defining {@link SESSION_MIME_TYPE}, for
 * `usr/share/mime/packages/` inside the AppDir.
 *
 * This is the piece the `.desktop` file's MimeType line has always assumed and
 * never had. `MimeType=` says "this application handles that type"; it does not
 * say which files are of it. Without a glob, no session ever matches, so the
 * declaration could never fire however thoroughly the AppImage was integrated.
 *
 * Same AppImage caveat as the url scheme, though: a bare AppImage installs none
 * of its own metadata. This makes the association *possible* for a user who
 * integrates it (AppImageLauncher, `appimaged`) or extracts it, rather than
 * making it happen.
 */
export function sessionMimeXml(productName: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="${SESSION_MIME_TYPE}">
    <comment>${productName} session</comment>
    <!-- a session is JSON, so anything that can only offer to open text still
         offers something useful -->
    <sub-class-of type="application/json"/>
    <glob pattern="*${SESSION_EXTENSION}"/>
  </mime-type>
</mime-info>
`
}

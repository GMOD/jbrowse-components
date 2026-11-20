---
name: windows-protocol-command-ends-switches
description: "The NSIS installer registers jbrowse:// as `\"jbrowse-desktop.exe\" \"%1\"`; the usual hardening is `-- \"%1\"`, so no link can carry a Chromium switch. Needs a Windows build to check what Electron and findLaunchTarget make of the `--`."
---

# The Windows protocol command ends the switches before the link

`products/jbrowse-desktop/scripts/packaging/nsisScript.ts` writes the
`jbrowse` scheme's open command as `"$INSTDIR\jbrowse-desktop.exe" "%1"`. The
hardening other Electron apps adopted after CVE-2018-1000006 is to end the
switches first, `"…exe" -- "%1"`, so a link whose text could break out of the
quotes still lands as an argument and never as `--gpu-launcher=…` or similar.

The risk today looks low, and neither half of why has been checked on a
Windows build: browsers percent-encode `"` in a url they hand to a protocol
handler, and Electron is understood to refuse to start when a switch follows a
url argument.

**Waits on a Windows machine** (or the `windows-desktop.yml` runner) to check:

- whether Chromium passes the `--` through to `process.argv`, and if so that
  `findLaunchTarget` (`electron/launchTarget.ts`) ignores it rather than
  reporting it as an unapplied argument. Its protocol branch runs first, so a
  link should be unaffected, but a file association sharing the command form
  would not be
- that a cold start and a `second-instance` delivery both still open the link
  (the README's smoke test)
- that `nsis.test.ts` pins the new command string

---
name: making-a-user-s-cancel-durable-across-a-settings-change
description: Making a user's Cancel durable across a settings change on the per-region displays
area: rendering-and-displays
---

# Making a user's Cancel durable across a settings change on the per-region displays

declined 2026-09-04 by the maintainer, from the v5 release audit.
`MultiRegionDisplayMixin.invalidateSettings` calls the internal `cancelFetch`,
which clears `fetchCanceled`, so a cancelled per-region display refetches when
any setting changes; the global-fetch family keeps the cancel until Retry. The
two families disagree and that is acceptable: a settings change is a gesture
on the display, and nobody has asked for the cancel to outlive it. Not a bug
to file again.

---
name: a-global-tools-sign-out-menu-item
description: A global `Tools → Sign out...` menu item
area: config-and-mst
---

# A global `Tools → Sign out...` menu item

built and backed out (2026-08).
A dialog listing every account holding a credential, with
`signOut()`/`hasCredential()` seams on the base internet-account model and a
`signOut()` override on the OAuth account to drop the refresh token too
(dropping only the access token silently signs the user back in on the next
read — that part is real and worth keeping if this ever returns). Rejected as
overfitting: authentication is rare, and a permanent top-level row in every
install to serve it is disproportionate. Apollo — whose product *is*
authenticated — already has its own `LogOut.tsx`; their having built one is
evidence about Apollo, not demand here, and reading it as demand is the
mistake to avoid repeating. Without a caller the `signOut()` seam is another
unused extension point, which is what `SelectorComponent` and
`getValidatedToken` were deleted for. If it earns its place later, the
contextual spot is the FileSelector beside the account toggle you just picked,
not a global menu. See [../ideas/internet-accounts.md](../ideas/internet-accounts.md).

---
title: Defaults for all tracks
description: Making one track setting the default for every track of that type
guide_category: General usage
---

**TL;DR:** most track-menu settings carry a push-pin beside them. Clicking it
makes that value the default for every track of the same type. An outline pin
means "not the default", a filled one means it is. Pinning never edits a track:
tracks that have no value of their own follow the new default immediately,
tracks you have already set keep theirs, and a snackbar offers to apply the
default to those.

This is the in-app counterpart to the `displayDefaults` an administrator can
bake into `config.json` (see
[display settings](/docs/tutorials/display_settings)). Anyone can set these, and
they last beyond the current session.

## Setting a default

Open the track menu, find the setting, and click the pin on the row for the
value you want. The pin fills in, and a "Set as the default" snackbar confirms
it.

<Figure caption="Making Compact the default read height. Top: the pin on the Compact preset. Bottom: the track that was following the default compacts, and the snackbar offers to apply it to the one open track with a height of its own." src="/img/feature_height_default.png" />

Three things follow from the pin only writing the default:

- Tracks with no value of their own for that setting pick the default up at
  once, including tracks you open later.
- Tracks you have already set keep what you gave them. The snackbar's **Override
  N customized tracks** action is what reaches those: it drops their own value
  so they follow the default instead.
- Choosing a value from a menu row, rather than from its pin, is a change to
  that one track, so a track you have clicked through is no longer following
  anything.

Clicking a filled pin clears the default again, and every track that was
following it goes back to JBrowse's built-in value.

Defaults are keyed to the **type of display** rather than to all tracks at once.
A read height default applies to your alignments tracks, a feature height
default to your gene and feature tracks. Two track types that happen to share a
setting name are independent.

## How a setting is resolved

Each setting is read in this order, first hit wins:

- the value set on that track, if it has one
- your default for that display type, if you have pinned one
- JBrowse's built-in value

## Finding the tracks a default affects

An open track whose appearance comes from a default is marked with a pencil in
the track selector. It opens a dialog naming the setting, the built-in value,
and what the track is showing now, with **Clear session default** to remove it.
Closed tracks carry no marker, because nothing is being shown differently yet.

<Figure caption="After pinning Compact, the alignments track carries a pencil in the track selector. The dialog it opens lists featureHeight under 'Session-wide default', and offers to clear it." src="/img/display_type_default_badge.png" />

The same pencil marks a track you have edited directly. The tooltip and the
dialog say which of the two it is, and a track affected by both lists them
separately.

## Reviewing all of your defaults

**Tools → Preferences → Reset to defaults...** lists every preference that
differs from its default, including one row per pinned default. Revert a single
row with its revert button, or reset them all at once.

## Where defaults are kept

Pinned defaults are personal and are stored in your browser, or in the app in
JBrowse Desktop. They are not part of the session, so they survive a reload and
apply to the next session you open, and they are not included when you share
one:

- A session you **share** or **export** records the values the tracks were
  actually showing, so whoever opens it sees the settings you had turned on even
  if they have pinned different defaults of their own.
- A setting you left at JBrowse's built-in value has nothing to record, so if
  the person opening it has pinned something there, theirs applies — the same
  way they view your session in their own theme.
- A track that recipient opens fresh in that session follows their defaults, as
  usual.
- Embedded components (`@jbrowse/react-linear-genome-view2` and friends) have no
  preference storage, so a default set there lasts as long as the page.

## Settings that offer a default

Each setting below resolves through a session-wide default for its display type.
Follow a link for what the setting does and what it falls back to when nothing
is pinned.

The pin itself lives on the setting's own row in the track menu, so you only
meet it where that menu offers the setting. A row appears while it applies to
what the track is drawing — line width on a line rendering, point size on a
scatter, the sashimi options once sashimi arcs are on — and a display that
borrows another display's settings but curates its own menu (the synteny display
reuses the alignments ones) offers only the rows it lists.

<!-- PROMOTABLE_SLOTS START -->

<!-- prettier-ignore -->
| Track type | Display | Settings with a session-wide default |
| --- | --- | --- |
| VariantTrack | [](/docs/config/lddisplay) | [`showLegend`](/docs/config/lddisplay/#slot-showlegend) |
| LDTrack | [](/docs/config/ldtrackdisplay) | [`showLegend`](/docs/config/ldtrackdisplay/#slot-showlegend) |
| SyntenyTrack | [](/docs/config/lgvsyntenydisplay) | [`colorBy`](/docs/config/lgvsyntenydisplay/#slot-colorby), [`featureHeight`](/docs/config/lgvsyntenydisplay/#slot-featureheight), [`heightMode`](/docs/config/lgvsyntenydisplay/#slot-heightmode), [`linkedReads`](/docs/config/lgvsyntenydisplay/#slot-linkedreads), [`mismatchAlpha`](/docs/config/lgvsyntenydisplay/#slot-mismatchalpha), [`readConnections`](/docs/config/lgvsyntenydisplay/#slot-readconnections), [`readConnectionsDown`](/docs/config/lgvsyntenydisplay/#slot-readconnectionsdown), [`sashimiArcsMode`](/docs/config/lgvsyntenydisplay/#slot-sashimiarcsmode), [`showLegend`](/docs/config/lgvsyntenydisplay/#slot-showlegend), [`showSashimiArcs`](/docs/config/lgvsyntenydisplay/#slot-showsashimiarcs), [`showSashimiLabels`](/docs/config/lgvsyntenydisplay/#slot-showsashimilabels), [`showSoftClipping`](/docs/config/lgvsyntenydisplay/#slot-showsoftclipping) |
| AlignmentsTrack | [](/docs/config/linearalignmentsdisplay) | [`colorBy`](/docs/config/linearalignmentsdisplay/#slot-colorby), [`featureHeight`](/docs/config/linearalignmentsdisplay/#slot-featureheight), [`heightMode`](/docs/config/linearalignmentsdisplay/#slot-heightmode), [`linkedReads`](/docs/config/linearalignmentsdisplay/#slot-linkedreads), [`mismatchAlpha`](/docs/config/linearalignmentsdisplay/#slot-mismatchalpha), [`readConnections`](/docs/config/linearalignmentsdisplay/#slot-readconnections), [`readConnectionsDown`](/docs/config/linearalignmentsdisplay/#slot-readconnectionsdown), [`sashimiArcsMode`](/docs/config/linearalignmentsdisplay/#slot-sashimiarcsmode), [`showLegend`](/docs/config/linearalignmentsdisplay/#slot-showlegend), [`showSashimiArcs`](/docs/config/linearalignmentsdisplay/#slot-showsashimiarcs), [`showSashimiLabels`](/docs/config/linearalignmentsdisplay/#slot-showsashimilabels), [`showSoftClipping`](/docs/config/linearalignmentsdisplay/#slot-showsoftclipping) |
| FeatureTrack | [](/docs/config/linearbasicdisplay) | [`displayDirectionalChevrons`](/docs/config/linearbasicdisplay/#slot-displaydirectionalchevrons), [`displayMode`](/docs/config/linearbasicdisplay/#slot-displaymode), [`heightMode`](/docs/config/linearbasicdisplay/#slot-heightmode), [`showLabels`](/docs/config/linearbasicdisplay/#slot-showlabels), [`showLegend`](/docs/config/linearbasicdisplay/#slot-showlegend), [`subfeatureLabels`](/docs/config/linearbasicdisplay/#slot-subfeaturelabels) |
| ReferenceSequenceTrack | [](/docs/config/lineargccontentdisplay) | [`lineWidth`](/docs/config/lineargccontentdisplay/#slot-linewidth), [`scatterPointSize`](/docs/config/lineargccontentdisplay/#slot-scatterpointsize) |
| GCContentTrack | [](/docs/config/lineargccontenttrackdisplay) | [`lineWidth`](/docs/config/lineargccontenttrackdisplay/#slot-linewidth), [`scatterPointSize`](/docs/config/lineargccontenttrackdisplay/#slot-scatterpointsize) |
| HicTrack | [](/docs/config/linearhicdisplay) | [`showLegend`](/docs/config/linearhicdisplay/#slot-showlegend) |
| GWASTrack | [](/docs/config/linearmanhattandisplay) | [`scatterPointSize`](/docs/config/linearmanhattandisplay/#slot-scatterpointsize), [`showLdLegend`](/docs/config/linearmanhattandisplay/#slot-showldlegend) |
| FeatureTrack | [](/docs/config/linearmultirowfeaturedisplay) | [`showLegend`](/docs/config/linearmultirowfeaturedisplay/#slot-showlegend) |
| VariantTrack | [](/docs/config/linearmultisamplevariantdisplay) | [`showLegend`](/docs/config/linearmultisamplevariantdisplay/#slot-showlegend) |
| VariantTrack | [](/docs/config/linearmultisamplevariantmatrixdisplay) | [`showLegend`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-showlegend) |
| VariantTrack | [](/docs/config/linearpairedarcdisplay) | [`lineWidth`](/docs/config/linearpairedarcdisplay/#slot-linewidth) |
| VariantTrack | [](/docs/config/linearvariantdisplay) | [`displayDirectionalChevrons`](/docs/config/linearvariantdisplay/#slot-displaydirectionalchevrons), [`displayMode`](/docs/config/linearvariantdisplay/#slot-displaymode), [`heightMode`](/docs/config/linearvariantdisplay/#slot-heightmode), [`showLabels`](/docs/config/linearvariantdisplay/#slot-showlabels), [`showLegend`](/docs/config/linearvariantdisplay/#slot-showlegend), [`subfeatureLabels`](/docs/config/linearvariantdisplay/#slot-subfeaturelabels) |
| QuantitativeTrack | [](/docs/config/linearwiggledisplay) | [`lineWidth`](/docs/config/linearwiggledisplay/#slot-linewidth), [`scatterPointSize`](/docs/config/linearwiggledisplay/#slot-scatterpointsize) |
| MultiQuantitativeTrack | [](/docs/config/multilinearwiggledisplay) | [`lineWidth`](/docs/config/multilinearwiggledisplay/#slot-linewidth), [`scatterPointSize`](/docs/config/multilinearwiggledisplay/#slot-scatterpointsize), [`showLegend`](/docs/config/multilinearwiggledisplay/#slot-showlegend) |

<!-- PROMOTABLE_SLOTS END -->

Settings not listed here are per-track only. Making one of those persistent is a
config edit.

## See also

- [](/docs/tutorials/display_settings)
- [Configuring tracks](/docs/config_guides/tracks)
- [](/docs/user_guides/alignments_track)
- [DISPLAY_TYPE_DEFAULTS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/DISPLAY_TYPE_DEFAULTS.md)
  — the promotable slots and CSS-style cascade behind the resolution order
  above, and how a default survives being serialized into a shared session

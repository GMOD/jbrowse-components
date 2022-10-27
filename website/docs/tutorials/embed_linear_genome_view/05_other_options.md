---
id: 05_other_options
title: Other options
---

There are some other optional things you can pass to JBrowse Linear Genome View
when you create it. We won't be adding any of these options for this demo, so
this page is just for your information.

## location

This is the location you would like the view to be in when it opens. For
example, if you wanted to have the view open to chromosome 1 from position
100,987,269 to position 100,987,368, you could specify it in one of these ways:

- `1:100987269..100987368`
- `1:100987269-100987368`
- `1:100,987,269..100,987,368`
- `chr1:100987269..100987368` (if you have aliases set up)

## plugins

JBrowse 2 allows you to provide plugins to add new features or modify behavior.
We won't get into them today, but you can read more about creating a plugin
[here](/docs/developer_guide).

## defaultSession

The "session" is the state of the view, e.g. what location is visible, what
tracks are open, whether the overview bar is open, etc. We'll get into this more
later in the tutorial.

## onChange

This is a function you can provide that runs each time something in the view
changes. We'll also talk about this more later in the tutorial.

## configuration

This is a place to put top-level configuration, such as the color theme that
JBrowse uses.

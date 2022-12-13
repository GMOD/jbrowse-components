---
id: bcc2020_embedding_jbrowse_02_introduction
title: Introduction
---

:::danger

Out of date Please see the
[updated version of this tutorial](/docs/tutorials/embed_linear_genome_view/01_introduction)

:::

## What is JBrowse 2

JBrowse 2 is a pluggable open-source platform for visualizing and integrating
biological data. At its core, it is a
[genome browser](https://en.wikipedia.org/wiki/Genome_browser), but it has also
been built as an extensible platform to enable visualization of all kinds of
biological data.

For those of you who have used the original JBrowse, you'll recognize many of
the ideas and use cases JBrowse 2 was built around. JBrowse 2 is a complete
rewrite of the original JBrowse, however, and so there are some differences. We
hope that you will see that these differences, along with the modern web
technologies that power JBrowse 2, enable JBrowse 2 to be an even more flexible
and useful tool.

## What does it mean to embed JBrowse 2?

JBrowse 2 is built around the idea of componentization, meaning that the
different pieces that are developed can be re-used to create different final
products. Our full web app, called JBrowse Web, can show not only traditional
linear genome browser views, but can also show Circos-style circular plots,
dotplots, comparative view, and more. It can also display multiple views
simultaneously.

Today we'll be using JBrowse Linear View, which has a subset of features of the
full app. It can display a single linear view, which is the most common mode of
genome visualization. Where JBrowse Web is a full-page web app, though, JBrowse
Linear View is designed to work within an existing web page. You can easily add
one or several of them to a page without the use of iframes, and control and
react to each instance.

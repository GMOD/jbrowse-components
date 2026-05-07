---
title: JBrowseR Release
date: 2021-02-22
tags: ['jbrowse 2', 'JBrowseR']
---

We are excited to announce a new JBrowse 2 product:
[JBrowseR](https://gmod.github.io/JBrowseR/). JBrowseR builds on top of the
[React component](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view)
that we recently released. Our React component inherits the general JBrowse 2
philosophy: it is fully customizable and pluggable, like the core product.

The React component makes it very straightforward to embed a Linear Genome View
into a React app. However, this API can come with a steep learning curve for
bioinformaticians who may not be very familiar with React. This is where
JBrowseR comes in!

JBrowseR provides an R interface to the JBrowse 2 LGV React component. Using
JBrowseR, you can:

- Embed the JBrowse 2 genome browser in **R Markdown** documents and **Shiny**
  applications
- Deploy a genome browser directly from the R console to view your data
- Customize your genome browser to display your own data

With this functionality, you can deploy a first-class genome browser with your
data in just a few lines of R code!

For more information on getting started, check out the following resources:

- [Package reference](https://gmod.github.io/JBrowseR/reference/index.html)
- [Introduction](https://gmod.github.io/JBrowseR/articles/JBrowseR.html)
- [Custom browser tutorial](https://gmod.github.io/JBrowseR/articles/custom-browser-tutorial.html)
- [JSON configuration tutorial](https://gmod.github.io/JBrowseR/articles/json-tutorial.html)
- [Creating URLS](https://gmod.github.io/JBrowseR/articles/creating-urls.html)

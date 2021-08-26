---
id: 01_introduction
title: Introduction
---

## Welcome!

Name searching is now available on JBrowse2!

You will now be able to search for names of features and reference sequences that are typed in the location search box of the Linear Genome View. In order for this to work, we will first need to create and configure a trix index into a JBrowse Web instance.

This tutorial will show you how.

## What do you need for this tutorial?

This tutorial assumes you have:

- Node 10+ installed
- JBrowse CLI installed in your computer

### Resources

<!-- For more information on how to get started with a JBrowse2 instance, you can refer to these [Super-quick start guide to JBrowse Web](./superquickstart_web.md) or [JBrowse web quick start](./quickstart_web.md) quick starts. -->

You can install the CLI tools by running the following command

```sh-session
npm install -g @jbrowse/cli
```

To test the installation, you can run

```sh-session
jbrowse --version
```

This will output the current version of the JBrowse CLI.

## An overview

1. We will create a JBrowse instance
2. Configure assemblies
3. Add tracks to the instance
4. Create an aggregate trix index
5. Create a single track trix index

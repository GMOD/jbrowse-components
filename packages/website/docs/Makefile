#!/bin/bash
SRC := $(shell node read_sidebar.js)


all: jbrowse2.pdf
	@for f in $(SRC); do cat $${f} | node parser.js; done | pandoc title.md - --toc -o jbrowse2.pdf

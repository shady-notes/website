---
title: Why every note is a plain Markdown file
date: 2026-11-06
topics: [behind-the-scenes]
summary: Shady Notes keeps each note as an ordinary .md file in a folder you choose, and here is why we built it that way.
email: true
status: published
---

Every note you write in Shady Notes is a standalone `.md` file on your disk. By
default they live in `~/Documents/ShadyNotes/`, and you can point the app at any
folder instead, including an Obsidian vault you already have. There is no
database file to export from and no format to convert out of.

This post explains why we made that choice early, and what it means for you
day to day.

## The file is the note

When you type in the shade, Shady Notes writes Markdown to a file. That is the
whole storage model. A folder in the sidebar is a folder on disk. A note called
`groceries` is `groceries.md`. Images you paste or drag in land in the
attachments folder and are linked with `![[wiki-links]]`, the same way Obsidian
links them.

Because of that, everything else on your Mac can already read your notes:

- Open the same folder in Obsidian and both apps see the same notes.
- Edit a note in VS Code and the shade reloads it.
- Search with Spotlight, `grep` or anything else that reads text.
- Back it up with Time Machine, Git or a copy to a USB drive.

## Your notes are not what you pay for

Shady Notes has a free tier that stays free, and a Personal and a Supporter
subscription for the extras: every theme, the built-in plugins and revision
history. We wanted it to be impossible for a subscription to hold your notes
hostage, and plain files are how that holds.

If a subscription ends, the app drops back to Free. The editor, the shade and
every note keep working, and the files were never anywhere but your disk. If
you stop using Shady Notes altogether, nothing needs exporting: the folder is
already the export.

## No server in the middle

Shady Notes has no sync service and no server holding your notes. You do not
need an account to write. If you subscribe, the app signs in to check that
subscription, and the only thing it sends is an account token, never a note.

If you want your notes on more than one Mac, put the folder somewhere that
already syncs, such as iCloud Drive or a Git repository. Shady Notes watches
for changes made outside the app and reloads them.

## It also keeps the app fast

Plain files are not only about leaving. At launch the app scans only each
note's metadata, and loads a note's full text when you open it. That keeps the
shade quick on vaults with thousands of notes.

The same index powers plugins. Daily Notes, Kanban and Tasks read the front
matter in your notes, so a kanban card is just another `.md` file. Turn the
plugin off and the cards are still notes.

## What we gave up

A custom format would make some things easier, such as storing rich layout
that Markdown cannot describe. We chose to stay inside Markdown and extend it
where Obsidian already has: callouts, wiki-links and front matter. If a feature
cannot be stored as something you could read in a text editor, we think twice
before building it.

Try it with a folder you already have:
[download Shady Notes](https://shadynotes.app/download).

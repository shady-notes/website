---
title: Get back an earlier version of a note
date: 2026-11-08
topics: [how-to]
summary: Revision history records your notes in the background as you write, so you can read, compare or restore any earlier version.
email: true
status: published
---

With revision history on, Shady Notes keeps earlier versions of every note while
you write. You can read any of them, compare two, and restore one if an edit
went wrong. There is no save button and no snapshot to remember.

## Turn it on

Open **Preferences → History** and enable it. From then on, Shady Notes records
changes in the background.

It doesn't record every keystroke. Two rules decide when a version is kept:

- **A minimum interval between versions**, so a burst of typing becomes one
  version rather than hundreds.
- **A content check**, so opening and closing a note without changing it adds
  nothing.

You can adjust both in **Preferences → History**.

## Read and restore a version

The timeline lists every recorded version of a note with its timestamp. Select
one to read it, or compare two side by side in the Navigator's diff panel.

When you restore a version, Shady Notes writes the old text back as a new
version. Nothing in the history is replaced, so if you restore the wrong one,
you can restore again.

## Where the history lives

History is kept in a git repository outside your vault, at a path you choose in
**Preferences → History**. That means:

- your notes folder has no `.git` directory in it;
- a vault you already keep in git yourself is left alone;
- syncing your vault doesn't sync the whole history.

Notes are small text files and git stores changes compactly, so the history is
usually a small part of your vault's size. A vault of a few thousand notes
edited every day generally stays in the tens of megabytes.

The repository is ordinary git, so `git log` works in it. Treat it as read-only,
though: the app manages it, and committing by hand can confuse it.

## If you sync your vault

When a sync client writes several files at once, Shady Notes waits a moment
before recording them, so you don't get a version per file. That wait is the
**External change debounce** setting in **Preferences → History**.

History also helps when a note changes in two places. If the same note is
edited in Shady Notes and by a sync at once, Shady Notes tries to merge the two.
If the edits overlap, it asks you which to keep. With history on, even a merge
that went wrong can be undone.

## Which plans include it

Revision history is part of the Personal and Supporter plans, and every new
install gets it free for the first 14 days. Turning it off keeps the history
you have. When a trial or plan ends, the history is kept too, and you can
browse it again once you're on a paid plan. Plans and prices are on
[the pricing page](https://shadynotes.app/pricing).

The full reference is in
[Revision history](https://docs.shadynotes.app/history/revisions/) in the docs.

---
title: Highlight tips and warnings with callouts
date: 2026-11-06
topics: [how-to]
summary: Typed callouts turn a Markdown blockquote into a coloured box with an icon, using the same syntax as Obsidian.
email: true
status: published
---

A callout is a blockquote with a type. Shady Notes renders it as a box with an
icon, a coloured title and a tinted background, so a tip or a warning stands
out from the rest of the note. Callouts arrived in v2.6.0.

## Write a callout

Start a blockquote with the type in square brackets:

```
> [!TIP]
> Press ⌃E to see the raw Markdown of any note.
```

Change the type to change the look:

```
> [!WARNING]
> This folder is shared with the whole team.
```

Shady Notes uses the Obsidian syntax, so the same note renders as a callout in
both apps. In any other Markdown viewer it is still a readable blockquote.

## Where callouts help

- **Meeting notes:** a `[!TIP]` for the decision, so it is the first thing you see.
- **How-to notes:** a `[!WARNING]` before the step that is easy to get wrong.
- **Project notes:** a callout at the top with the current status.

Keep them for the one or two lines that matter. A note that is all callouts
highlights nothing.

## See the source

Callouts render as you type. To see or edit the Markdown behind one, press ⌃E
to show the raw source, and press it again to go back.

Try one in your next note. If you do not have Shady Notes yet,
[download it](https://shadynotes.app/download).

---
title: Write your own plugin in one markdown file
date: 2026-11-08
topics: [how-to]
summary: A Shady Notes plugin is a markdown file with its definition in the front matter, so you can build your own view of your notes without a build step.
email: true
status: published
---

Shady Notes comes with plugins for Daily Notes, Kanban and Tasks. You can also
write your own, and a plugin is one markdown file. You describe which
notes to show and how to draw them in the front matter, and the app renders it
with native components.

## A plugin is a view, not a store

A plugin doesn't keep data of its own. A Kanban board is your notes arranged by
a front-matter field, and Tasks is the checkboxes already in your notes. If you
turn a plugin off, nothing is lost, because everything underneath is still
plain markdown.

## Start by reading a built-in

The quickest way to learn the format is to read one that works. Right-click a
plugin in the sidebar and choose **View Definition** to see its source.

## The shape of a plugin

Here is a complete plugin that lists the books you've finished, best rated
first:

```yaml
---
plugin: my-bookshelf
name: Bookshelf
icon: book
schema:
  - name: title
    type: string
  - name: rating
    type: number
query:
  folder: Reading
  where: status == "finished"
  sort: rating desc
layout:
  type: list
  fields: [title, rating]
actions:
  - name: newBook
    label: Add a book
    template: "{{title}}.md"
---
```

It has five parts:

- **schema**: the front-matter fields the plugin reads.
- **query**: which notes to include, and in what order. `where` takes an
  expression over front-matter fields, and `sort` takes a field and a
  direction.
- **layout**: how to draw them. There are more than thirty components,
  including lists, tables, boards, cards, timelines and counters.
- **actions**: buttons, and the notes they create. Filenames and contents use
  templates, so `{{today | format 'yyyy-MM-dd'}}.md` names a note after
  today's date.
- **name** and **icon**: how the plugin appears in the sidebar.

## Install it

Save the file in the `plugins/` folder inside your vault, then restart
Shady Notes:

```text
~/Documents/ShadyNotes/
├── plugins/
│   └── my-bookshelf.md
├── Reading/
└── Welcome.md
```

The plugin then appears in **Preferences → Plugins** under **Installed
Plugins**, with a toggle. Turn it on and it shows up in the puzzle-piece tab in
the sidebar. To update it, replace the file and restart. A file with the same
`plugin:` id takes over from the old one.

## Make it fit every theme

Use the semantic theme tokens, such as accent, background and muted, rather
than fixed colours. A plugin written against them looks right in all sixteen
themes.

## What a plugin can reach

A plugin reads and writes notes in the folder it's pointed at. It has no access
to the rest of your Mac and no network access of its own. Because it can
write to your notes, only install plugins you understand. Since each one is a
readable markdown file, you can check what it does before you turn it on.

## Which plans include plugins

Plugins are part of the Personal and Supporter plans, and every new install
gets all of them free for the first 14 days. Plans and prices are on
[the pricing page](https://shadynotes.app/pricing).

The full reference is in
[Writing a plugin](https://docs.shadynotes.app/plugins/authoring/) in the docs.

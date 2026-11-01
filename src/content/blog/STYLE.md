# Writing guide: blog and newsletter

One guide for both, because every post may also be an email. Visual rules live
in `DESIGN.md` at the repo root; this file is about the words.

## Tone

- Plain, concrete and calm. Say what changed and what you can do with it.
- No hype: not "revolutionary", "game-changing", "supercharge", "seamless",
  "blazing", "magic", "unleash", "level up".
- No self-vouching: not "honest", "trust us", "we care deeply", "transparent".
  Show it instead.
- No apologising for the length of a post, and no "exciting news".

## Voice

- "You" is the reader. "We" is Round Rect.
- Active voice. Short paragraphs: three or four sentences at most.
- Name the thing on screen exactly as the app labels it (**Navigator**,
  **Settings → General**). Keyboard shortcuts as glyphs: ⌘⇧N, ⌥Tab.

## Names and spelling

- **Shady Notes** — two words, both capitalised. Never "ShadyNotes" in prose
  (that is the bundle and download name), never "Shady notes".
- Australian spelling: colour, organise, behaviour, licence (noun), license (verb).
- Dates: 1 November 2026. Versions: v4.1.19, or "4.1" for a series.
- macOS, Markdown, Obsidian, Homebrew — as their owners write them.

## No internal language

No feature numbers (`008`), branch names, PR numbers, "rc", ticket ids, or the
names of internal tools and servers. If a reader cannot act on it, cut it.

## Links

Absolute URLs (`https://shadynotes.app/download`), because the post is also an
email and relative links break there. Link the download page, not a DMG file.
Docs links go to `https://docs.shadynotes.app/…`.

## Shape of a post

- **Title:** says what the post is about, under 60 characters. No clickbait, no
  colon-subtitle unless it carries information. It is also the email subject.
- **Slug:** a few words from the title, lowercase, hyphens. A release post is
  `shady-notes-v<version>` (for example `shady-notes-v4-2`).
- **Summary:** one sentence that stands on its own. It is the blog list entry,
  the link preview and the email preheader.
- **Opening:** start with the content. The first paragraph says what is new or
  what the reader will be able to do.
- **Headings:** `##` only (the page title is the only `#`). Sentence case.
- **Commands:** in fenced code blocks, copy-pasteable, one command per line, no
  `$` prompt.
- **Screenshots:** real app screenshots, under about 300 KB each, with alt text
  that says what the image shows.
- **Length:** release news 150–400 words; how-to as long as the task needs and
  no longer; behind-the-scenes 400–1200 words.
- **Ending:** one line. Where to get it, or what to try next. No sign-off
  paragraph.

## Topics

- `release-news`: a new version — what changed, why it matters, how to update.
- `how-to`: one workflow, start to finish, in the current version.
- `behind-the-scenes`: why something is built the way it is. Facts, not
  roadmap promises.

## Promises

- Never contradict the privacy policy (`/privacy`).
- No tracking, so never "we noticed you…" or anything implying we watch usage.
- No dates for unreleased features. Say "next" or say nothing.
- Prices and plans only as `/pricing` shows them on the day of posting.

## Before publishing

- [ ] Title under 60 characters, sentence reads well as an email subject
- [ ] Summary is one sentence and makes sense alone
- [ ] Folder date equals `date:`; slug follows the rule and is in `src/data/blog-addresses.ts`
- [ ] Every link is absolute and opens
- [ ] Every image has alt text and is under about 300 KB
- [ ] Commands copy-paste and run
- [ ] Version numbers and feature names checked against the app's CHANGELOG
- [ ] No hype words, no self-vouching words, no internal language
- [ ] Nothing contradicts `/privacy`, `/pricing` or `/terms`
- [ ] Read once in `npm run dev` at phone width

# Screenshots

Committed, optimised screenshots for the docs. **Plain git, deliberately not
git-lfs** — Dokploy's clone would not fetch lfs objects, so the build would
succeed while shipping a docs site full of broken images. That failure is silent,
which is what makes it dangerous.

Budget: **300 KB per file, 20 MB total**. `make docs-shots-budget` enforces both.

Raw, un-optimised captures belong in `docs-site/.captures/` (gitignored). Only
derivatives are committed.

## How to (re)capture

```bash
./scripts/capture-docs-shots.sh          # full session
./scripts/capture-docs-shots.sh --seed   # just rebuild the sandbox
```

The script runs the **installed release binary** inside a DEV sandbox
(`SHADY_DEV=1`), which redirects prefs to `dev.jscott.betterunclutter.dev` and
the vault to `~/Documents/ShadyNotes-Dev/`. Your real prefs domain and vault are
never touched.

It seeds `shadyTrialStartedAt` into the sandbox so `LicenseManager.trialTier()`
reports a live 14-day trial. That legitimately unlocks the three gated features
— plugins, all themes, revision history — with no patched build and no fake
licence. Without it, every premium shot renders as `LockedFeatureView`.

## Before the first capture, every session

1. **Dismiss the build pill.** `BuildInfoOverlay` ships ungated in release
   (`ContentView.swift:166`), so a `build 0210 · …` chip sits bottom-right of
   the shade. Click it. It will otherwise be in every single screenshot.
2. **Close anything personal.** The shade is translucent and floats over
   whatever is behind it. Put a neutral, empty window back there — not mail, not
   chat, not another project. A capture that leaks someone's real work is not
   fixable by cropping.
3. **Hide the Dock** (<kbd>⌥⌘D</kbd>).
4. **Size the shade to ~1400–1600 pt wide.** Shots are captured large and
   rendered at ≤760 CSS px (`docs.css`), which is what buys back apparent
   sharpness on Retina screens — the capture machine has none.

## The `(DEV)` caveat

In the sandbox the toolbar reads **“Shady Notes (DEV)”**
(`ContentView.swift:196`). For shots where that label is prominent — the hero,
the toolbar tour, window mode — either:

- run the separate snapshot-and-restore pass against the real prefs domain
  (`--release-pass`, and read its warning first), or
- fix it upstream: gate the suffix and `BuildInfoOverlay` behind `isDev` in the
  app repo and ship 4.1.20. That removes the need for the restore pass entirely
  and is the better answer if a release is due anyway.

## Naming

`<area>-<subject>[-<variant>].png` — e.g. `shade-open-hero.png`,
`sidebar-file-tree.png`, `plugin-kanban.png`, `prefs-editor.png`.

## Manifest

Fill in as shots land. Every image needs real `alt` text at its use site — this
is a docs site, alt text is not optional.

54 slots are referenced from the pages. Every one is in
`scripts/capture-docs-shots.sh`; the two lists are kept in step deliberately, so
a page can never reference a shot the script does not take.

| File | Shows | Page | Captured |
|---|---|---|---|
| `callout-type-panel.png` | The callout type picker listing the available callout types with their icons. | `/writing/callouts/` || ✅ |
| `callouts-gallery.png` | A note showing all nine callout types rendered with their icons and colours. | `/writing/callouts/` || ✅ |
| `checkboxes-list.png` | A checklist with completed and outstanding tasks, some in a bulleted list and one stand… | `/tour/`, `/writing/checkboxes/` | ✅ |
| `conflict-diff.png` | The Merge Conflict window, showing one version at a time diffed against the common ancestor. | `/history/conflicts/` | ✅ |
| `editor-raw-mode.png` | The same note in raw mode, showing plain Markdown source with syntax colouring. | `/writing/editor/` | ✅ |
| `editor-wysiwyg.png` | A note rendered live, with headings, bold text, a table and checkboxes styled in the ed… | `/tour/`, `/writing/editor/` | ✅ |
| `find-replace-bar.png` | The find and replace bar with a search term entered and matches highlighted in the note. | `/writing/find-replace/` | ✅ |
| `finder-vault.png` | A Finder window showing the vault folder containing Markdown files and subfolders. | `/concepts/vault-and-files/` || ✅ |
| `image-inline.png` | A note with an inline image displayed at a set width. | `/writing/images/` || ✅ |
| `image-preview-window.png` | The image preview window showing an image at full size. | `/writing/images/` || ✅ |
| `install-dmg-window.png` | The mounted Shady Notes disk image, showing the app icon beside an Applications folder … | `/install/` | ✅ |
| `markdown-kitchen-sink.png` | A note demonstrating every supported Markdown feature rendered in the editor. | `/writing/markdown/` | ✅ |
| `menubar-icon.png` | The Shady Notes umbrella icon in the macOS menu bar. | `/first-run/` || ✅ |
| `navigator-diff.png` | The Navigator diff panel showing additions and deletions between two versions of a note. | `/organising/navigator/` | ✅ |
| `navigator-filters.png` | The Navigator's workspace filter pills, with one workspace selected. | `/organising/navigator/` | ✅ |
| `navigator-window.png` | The Navigator window listing notes from several file trees with filter pills across the… | `/organising/navigator/`, `/tour/` | ✅ |
| `plugin-daily-notes.png` | The Daily Notes plugin showing a timeline of dated entries. | `/plugins/daily-notes/` | ✅ |
| `plugin-definition-viewer.png` | The View Definition panel showing a plugin's front-matter source. | `/plugins/authoring/` || ✅ |
| `plugin-kanban.png` | A Kanban board with cards arranged in status columns. | `/plugins/kanban/`, `/tour/` | ✅ |
| `plugin-scope-picker.png` | The plugin scope picker, choosing which folder a plugin reads from. | `/plugins/overview/` || ✅ |
| `plugin-tasks.png` | The Tasks plugin listing checkboxes gathered from across the vault, each linked to its … | `/plugins/tasks/` | ✅ |
| `plugins-sidebar.png` | The plugins sidebar tab listing the built-in plugins with enable toggles. | `/plugins/overview/` | ✅ |
| `prefs-appearance.png` | The Appearance tab in Preferences. | `/customising/appearance/`, `/reference/settings/` | ✅ |
| `prefs-checkbox-styles.png` | The checkbox style picker in Preferences showing the five available styles. | `/writing/checkboxes/` || ✅ |
| `prefs-editor.png` | The Editor tab in Preferences. | `/customising/editor-settings/`, `/reference/settings/` | ✅ |
| `prefs-history.png` | The History tab in Preferences showing repository location and commit interval settings. | `/history/git-backend/`, `/reference/settings/` | ✅ |
| `prefs-plugins.png` | The Plugins tab in Preferences. | `/reference/settings/` | ✅ |
| `prefs-premium-free.png` | The Premium tab in Preferences showing days remaining in the trial. | `/account/licensing/`, `/reference/settings/` | ✅ |
| `prefs-premium-signed-in.png` | The Premium tab showing a signed-in account with its email address. | `/account/sign-in/` || ✅ |
| `prefs-shortcuts.png` | The Shortcuts tab in Preferences. | `/customising/shortcuts/`, `/reference/settings/` | ✅ |
| `prefs-vault.png` | The Vault tab in Preferences, including the conflict-resolution mode. | `/reference/settings/` | ✅ |
| `prefs-workspaces.png` | The Workspaces tab in Preferences, listing workspaces with colour, assigned folder and … | `/concepts/workspaces/`, `/reference/settings/` | ✅ |
| `pull-tab-hover.png` | The pull tab expanded to its full width as the pointer hovers over it. | `/first-run/` || ✅ |
| `pull-tab-idle.png` | The pull tab collapsed to a small dot beneath the menu bar. | `/first-run/` || ✅ |
| `revision-history-overlay.png` | The revision history overlay showing a timeline of versions for a note. | `/history/revisions/` | ✅ |
| `shade-closed.png` | A desktop with the shade closed; only the small pull tab is visible below the men… | `/concepts/the-shade/` | ✅ |
| `shade-open-hero.png` | The Shady Notes shade open over a desktop, showing the sidebar file tree on the left an… | `/tour/` | ✅ |
| `shade-opening.png` | The shade partway open, hanging below the menu bar with the pull tab at its lower edge. | `/concepts/the-shade/` | ✅ |
| `shortcuts-overlay.png` | The keyboard shortcuts overlay listing shortcuts grouped by category. | `/reference/menus/` | ✅ |
| `sidebar-file-tree.png` | The sidebar file tree with Projects, Reference and Snippets folders expanded. | `/organising/sidebar/`, `/tour/` | ✅ |
| `sidebar-search.png` | The sidebar search field with a term entered and matching notes listed. | `/organising/sidebar/` || ✅ |
| `sidebar-starred.png` | The Starred sidebar tab listing starred notes with amber stars. | `/organising/starred/` | ✅ |
| `signin-connect-page.png` | The shadynotes.app connect page shown in a browser during sign-in. | `/account/sign-in/` || ✅ |
| `slash-command-panel.png` | The slash command picker open in the editor, listing available commands with icons. | `/writing/slash-commands/` | ✅ |
| `sparkle-update-dialog.png` | The Sparkle update dialog offering a new version with release notes. | `/account/updates/` | ✅ |
| `statusbar-menu.png` | The menu bar status item menu open, showing Show/Hide Notes, Window Mode, Preferences a… | `/reference/menus/` | ✅ |
| `sticky-note.png` | A sticky note floating over a desktop, showing a short checklist. | `/organising/sticky-notes/` || ✅ |
| `tab-bar.png` | The tab bar with four notes open and the active tab underlined in amber. | `/organising/tabs/` || ✅ |
| `table-rendered.png` | A rendered Markdown table with borders and aligned columns. | `/writing/tables/` | ✅ |
| `table-toolbar.png` | The table toolbar panel floating near a table, showing row and column controls. | `/writing/tables/` | ✅ |
| `theme-gallery.png` | The Themes sidebar tab listing themes with colour swatches and a search field. | `/customising/themes/` | ✅ |
| `theme-picker.png` | The theme picker overlay showing colour swatches for the available themes. | `/customising/themes/`, `/tour/` || ✅ |
| `toolbar-map.png` | The Shady Notes toolbar, showing the sidebar toggle, raw-mode, pin, window-mode and men… | `/tour/` | ✅ |
| `toolbar-menu.png` | The toolbar ellipsis menu open, showing grouped Notes, View, Editing and Other sections. | `/reference/menus/` || ✅ |
| `workspace-dots.png` | The workspace strip showing three coloured workspace pills, one active. | `/concepts/workspaces/`, `/tour/` || ✅ |

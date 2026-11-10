// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import readingSurfaces from "./src/plugins/reading-surfaces.mjs";

// Docs live on their OWN origin and their OWN Cloudflare Worker (shadynotes-docs,
// see wrangler.jsonc), deliberately separate from site/. Two reasons, both
// load-bearing:
//
//  1. Starlight 0.41 requires astro ^7.0.2; site/ pins astro ^5.1.0 and
//     @clerk/astro ^3.4.16. Folding docs into site/ would drag the revenue-path
//     sign-in flow (/app/connect, which the macOS app depends on) through two
//     majors for a documentation change. See changes/006-LICENSING-CLERK/006.04
//     for how expensive breaking that path already proved once.
//  2. Blast radius: a broken docs build cannot take down shadynotes.app, and a
//     docs deploy does not rebuild the marketing site.
//
// There is NO Clerk integration here on purpose. Docs need no auth, and keeping
// @clerk/astro out means no middleware, no publishable key in a second build
// context, and no Clerk JS on every docs page load.
export default defineConfig({
  site: "https://docs.shadynotes.app",
  output: "static",
  compressHTML: true,
  markdown: { rehypePlugins: [readingSurfaces] },
  integrations: [
    starlight({
      title: "Shady Notes",
      description:
        "Documentation for Shady Notes — a macOS markdown notes app that slides down from the menu bar like a window shade.",
      logo: {
        src: "./src/assets/logo.png",
        alt: "Shady Notes",
        replacesTitle: false,
      },
      // PNG, not SVG: the mark is the app's own raster line art. Byte-identical
      // to site/public/favicon.png on purpose — one tab icon across both origins.
      favicon: "/favicon.png",
      customCss: ["./src/styles/docs.css"],
      lastUpdated: true,
      expressiveCode: { themes: ["github-light"] },
      head: [
        // Open Graph needs absolute URLs; a relative path leaves the card
        // imageless on most scrapers even when the file is served fine.
        //
        // Renamed from og-image.png when the card was restyled, and that is the
        // point: Slack, Twitter and Facebook cache previews against the IMAGE
        // URL, so overwriting in place keeps serving the old card from their
        // caches for weeks. Rename again on the next redesign.
        { tag: "meta", attrs: { property: "og:image", content: "https://docs.shadynotes.app/og-cover.png" } },
        { tag: "meta", attrs: { name: "twitter:image", content: "https://docs.shadynotes.app/og-cover.png" } },
        { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
        // Click-to-zoom for screenshots. docs.css caps content images at 760px
        // to keep them sharp on HiDPI; this hands the detail back on demand.
        // Loaded here rather than from a component so it also covers the splash
        // home page, and deferred so it never blocks the parse.
        { tag: "script", attrs: { src: "/image-zoom.js", defer: true } },
      ],
      // The app repo is separate and private; an "edit this page" link would
      // point at a repo readers cannot reach.
      editLink: undefined,
      social: [
        {
          icon: "discord",
          label: "Discord",
          href: "https://discord.gg/2TT9Mm9Uzf",
        },
      ],
      components: {
        PageFrame: "./src/components/PageFrame.astro",
        Header: "./src/components/Header.astro",
        PageTitle: "./src/components/PageTitle.astro",
        ThemeSelect: "./src/components/ThemeSelect.astro",
        // Sends readers back to the marketing site from the docs header.
        SiteTitle: "./src/components/SiteTitle.astro",
        // Adds "Documented against 4.1.19" so version drift is visible.
        Footer: "./src/components/Footer.astro",
      },
      sidebar: [
        {
          label: "Getting started",
          items: [
            { label: "Install", slug: "install" },
            { label: "First run", slug: "first-run" },
            { label: "Tour", slug: "tour" },
          ],
        },
        {
          label: "Core concepts",
          items: [
            { label: "The shade", slug: "concepts/the-shade" },
            { label: "Vault and files", slug: "concepts/vault-and-files" },
            { label: "Workspaces", slug: "concepts/workspaces" },
          ],
        },
        {
          label: "Writing",
          items: [
            { label: "The editor", slug: "writing/editor" },
            { label: "Markdown reference", slug: "writing/markdown" },
            { label: "Checkboxes", slug: "writing/checkboxes" },
            { label: "Tables", slug: "writing/tables" },
            { label: "Callouts", slug: "writing/callouts" },
            { label: "Images", slug: "writing/images" },
            { label: "Slash commands", slug: "writing/slash-commands" },
            { label: "Find and replace", slug: "writing/find-replace" },
          ],
        },
        {
          label: "Organising",
          items: [
            { label: "The sidebar", slug: "organising/sidebar" },
            { label: "Tabs", slug: "organising/tabs" },
            { label: "Starred notes", slug: "organising/starred" },
            { label: "Navigator", slug: "organising/navigator" },
            { label: "Sticky notes", slug: "organising/sticky-notes" },
          ],
        },
        {
          label: "History",
          items: [
            { label: "Revision history", slug: "history/revisions" },
            { label: "The git backend", slug: "history/git-backend" },
            { label: "Conflicts", slug: "history/conflicts" },
          ],
        },
        {
          label: "Plugins",
          items: [
            { label: "Overview", slug: "plugins/overview" },
            { label: "Daily Notes", slug: "plugins/daily-notes" },
            { label: "Kanban", slug: "plugins/kanban" },
            { label: "Tasks", slug: "plugins/tasks" },
            { label: "Installing plugins", slug: "plugins/catalog" },
            { label: "Writing a plugin", slug: "plugins/authoring" },
          ],
        },
        {
          label: "Customising",
          items: [
            { label: "Themes", slug: "customising/themes" },
            { label: "Appearance", slug: "customising/appearance" },
            { label: "Editor settings", slug: "customising/editor-settings" },
            { label: "Shortcuts", slug: "customising/shortcuts" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Keyboard shortcuts", slug: "reference/keyboard-shortcuts" },
            { label: "Settings", slug: "reference/settings" },
            { label: "Menus", slug: "reference/menus" },
            { label: "File formats", slug: "reference/file-formats" },
          ],
        },
        {
          label: "Account",
          items: [
            { label: "Licensing", slug: "account/licensing" },
            { label: "Signing in", slug: "account/sign-in" },
            { label: "Updates", slug: "account/updates" },
          ],
        },
        {
          label: "Help",
          items: [
            { label: "Troubleshooting", slug: "help/troubleshooting" },
            { label: "FAQ", slug: "help/faq" },
            { label: "Privacy and data", slug: "help/privacy-and-data" },
            { label: "Changelog", slug: "help/changelog" },
          ],
        },
      ],
    }),
    sitemap(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: "auto",
  },
});

import clerk from "@clerk/astro";
// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { blogAddresses } from "./src/data/blog-addresses.ts";

// Renamed blog posts keep their old address as a redirect page (GitHub Pages
// cannot send a 301; add a Cloudflare redirect rule for that too). See
// src/data/blog-addresses.ts.
const blogRedirects = Object.fromEntries(
  Object.entries(blogAddresses.renamed).map(([from, to]) => [`/blog/${from}`, `/blog/${to}/`]),
);
// Until the first post is published the blog index is an empty page; keep it
// (and its feed) out of the sitemap rather than advertising it to crawlers.
const blogIsEmpty = blogAddresses.addresses.length === 0;

export default defineConfig({
  site: "https://shadynotes.app",
  output: "static",
  compressHTML: true,
  redirects: blogRedirects,
  markdown: {
    // DESIGN.md: code blocks are monochrome (white, black frame). Shiki's
    // default theme would paint them dark with inline styles.
    syntaxHighlight: false,
  },
  integrations: [
    clerk({
      // Theme all Clerk UI (pricing table, sign-in, user button) to the Shady
      // Notes white, black and yellow web design.
      appearance: {
        variables: {
          colorPrimary: "#ffd60a",
          colorBackground: "#ffffff",
          colorForeground: "#000000",
          colorMutedForeground: "#555555",
          colorInput: "#ffffff",
          colorInputForeground: "#000000",
          colorPrimaryForeground: "#000000",
          colorBorder: "#000000",
          colorNeutral: "#000000",
          fontFamily: "-apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif",
          borderRadius: "0.75rem",
        },
      },
    }),
    sitemap({
      // /coming-soon 301s to / on the public hosts — it only still exists as a
      // file for nginx's default_server holding page. Listing a URL that
      // redirects is a crawl error, so keep it out of the sitemap.
      // /thanks and /license/pending are post-purchase pages, not landing pages.
      filter: (page) =>
        !["/coming-soon", "/thanks", "/license/pending"].some((path) => page.includes(path)) &&
        !(blogIsEmpty && page.includes("/blog/")),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: "auto",
  },
});
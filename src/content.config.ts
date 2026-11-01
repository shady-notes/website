import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { TOPIC_IDS } from "~/config/blog";

// Posts live at src/content/blog/YYYY-MM-DD-slug/index.md with their images
// beside them. Only `*/index.md` is loaded, so README.md and STYLE.md in that
// folder are documentation, not posts. The entry id is the folder name; the
// public slug (date stripped) and the folder/date checks are in lib/blog.ts.
//
// `.strict()` makes an unknown or misspelt key a build error, as in the
// playbook's blog-build.py.
const blog = defineCollection({
  loader: glob({
    pattern: "*/index.md",
    base: "./src/content/blog",
    generateId: ({ entry }) => entry.split("/")[0],
  }),
  schema: z
    .object({
      // Also the email subject — keep it short enough not to be cut off.
      title: z.string().min(1).max(60),
      date: z.coerce.date(),
      topics: z.array(z.enum(TOPIC_IDS)).min(1),
      // One sentence: blog list, link preview, feed summary and email preheader.
      summary: z.string().min(1).max(200),
      // false = blog only, never mailed.
      email: z.boolean(),
      status: z.enum(["draft", "published"]),
      // Set when a post is renamed: the old slug keeps working as a redirect.
      formerly: z.string().optional(),
    })
    .strict(),
});

export const collections = { blog };

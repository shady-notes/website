// The ledger of every blog address that has ever been public.
//
// A published slug is a promise: people link to it, feed readers key on it, and
// the newsletter mails it. The build (lib/blog.ts) refuses to:
//   - publish a post whose slug is not listed in `addresses` (add it here in the
//     same commit you flip `status: published` — that is the deliberate step);
//   - drop an address: every entry in `addresses` must be a published post, a
//     key of `renamed`, or listed in `retired`;
//   - re-use a retired address for a new post.
//
// Renaming a post: change the folder name, add the new slug to `addresses`, and
// add `"old-slug": "new-slug"` to `renamed`. astro.config.mjs turns that into a
// redirect page; also add a Cloudflare redirect rule for a real 301 (GitHub
// Pages cannot send one).
//
// Retiring a post: delete (or unpublish) it and add its slug to `retired`.

export const blogAddresses = {
  addresses: ["hello-blog", "plain-markdown-files", "open-the-shade", "navigator-tabs"] as string[],
  renamed: {} as Record<string, string>,
  retired: [] as string[],
};

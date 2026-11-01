// Blog + newsletter constants. Everything a domain move or a new topic touches
// lives here, not scattered through the pages (playbook §5, "hard-coded names").

/**
 * Post topics. A post carries one or more; newsletter sign-ups pick the ones
 * they want, and the sender only mails a post to people interested in at least
 * one of its topics. Ids are stored in subscriber records — never rename one,
 * only add. Labels are free to change.
 */
export const TOPICS = {
  "release-news": {
    label: "Release news",
    description: "What changed in a new version and why.",
  },
  "how-to": {
    label: "How-to",
    description: "One workflow, start to finish.",
  },
  "behind-the-scenes": {
    label: "Behind the scenes",
    description: "How and why Shady Notes is built the way it is.",
  },
} as const;

export type TopicId = keyof typeof TOPICS;
export const TOPIC_IDS = Object.keys(TOPICS) as [TopicId, ...TopicId[]];

/**
 * Atom entry ids are `${FEED_ID_BASE}<slug>`. PINNED ON DAY ONE: if this ever
 * changes, every feed reader shows every post as new again. It is a tag: URI,
 * not a URL, so it survives a domain move unchanged — leave it alone even then.
 */
export const FEED_ID_BASE = "tag:shadynotes.app,2026:blog/";
export const FEED_TITLE = "Shady Notes blog";
export const FEED_SUBTITLE = "Release news, how-tos and notes from building Shady Notes.";

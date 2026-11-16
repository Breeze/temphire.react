import DOMPurify from 'dompurify';
import { marked } from 'marked';

import { resourceLink } from '../resource-mgt/resource-link';
import { MentionedPerson, linkPeople } from './link-people';

/**
 * Renders one of Quinn's answers to HTML: the people it mentions linked to their records, then the
 * Markdown rendered, then the result sanitized.
 *
 * Port of the Angular client's `quinn/markdown.pipe.ts` and `quinn/link-people.pipe.ts`, which the
 * template chained: `content | linkPeople: people | markdown`.  React has no pipes; this is the
 * same chain as a function.
 *
 * **Sanitizing.**  The Angular pipe bound its result with `[innerHTML]`, and Angular's sanitizer
 * removed scripts, event handlers and `javascript:` links on the way in.  React does no such
 * thing: the only way to insert HTML is `dangerouslySetInnerHTML`, and it inserts exactly what it
 * is given - the name is the warning.  So the HTML goes through DOMPurify first.  That matters
 * because the text comes from a language model and, through it, from data anyone in the company can
 * edit.
 */
export function renderAnswer(
  markdown: string,
  people: readonly MentionedPerson[] | null | undefined,
): string {
  if (!markdown) {
    return '';
  }

  const linked = linkPeople(markdown, people, resourceLink);
  const html = marked.parse(linked, { async: false, gfm: true, breaks: true }) as string;
  return DOMPurify.sanitize(html);
}

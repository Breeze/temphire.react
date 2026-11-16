// Copied from the Angular client's src/app/resource-mgt/resource-link.ts; only this comment changed.
/**
 * The in-app URL that opens a staffing resource in Resource Management.
 *
 * `ResourceMgt` reads the id from the query string (`useSearchParams`), opens that person and
 * searches for them.  Quinn links the people it mentions here.
 * This is the only place outside the route table that knows the URL.
 */
export function resourceLink(id: string): string {
  return `/resourcemgt?resource=${encodeURIComponent(id)}`;
}

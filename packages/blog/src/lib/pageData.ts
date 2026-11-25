import type { Post, PostSummary } from "./posts";

/** What the server already fetched for the URL it rendered. Embedded in the page
 *  as JSON so the browser hydrates from the same data instead of refetching. */
export type PageData =
  | { kind: "index"; posts: PostSummary[] }
  | { kind: "post"; post: Post }
  | { kind: "not-found" };

export interface InitialState {
  path: string;
  data: PageData;
}

export const DATA_SCRIPT_ID = "blog-data";

// Built from char codes so no raw line-separator character ever sits in source.
const LINE_SEP = new RegExp(String.fromCharCode(0x2028), "g");
const PARA_SEP = new RegExp(String.fromCharCode(0x2029), "g");

/** JSON that is safe inside a <script> element: a `</script>` in a post cannot
 *  close it early, and U+2028/2029 cannot break the parse. */
export function serializeForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LINE_SEP, "\\u2028")
    .replace(PARA_SEP, "\\u2029");
}

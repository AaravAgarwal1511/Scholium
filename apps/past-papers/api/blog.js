// /blog and /blog/* (rewritten here by vercel.json) render through @repo/blog.
// dist-server/blog.js is produced by `vite build` (the @repo/blog/vite plugin):
// one self-contained file, so this function only works after a build.
export { default } from "../dist-server/blog.js";

import { Route, Routes } from "react-router-dom";
import { BlogProvider } from "./lib/context";
import type { PostsApi } from "./lib/posts";
import type { InitialState } from "./lib/pageData";
import { Layout } from "./components/Layout";
import IndexPage from "./pages/IndexPage";
import PostPage from "./pages/PostPage";
import NotFound from "./pages/NotFound";

/** Router-agnostic: entry-client wraps it in BrowserRouter, entry-server in
 *  StaticRouter, tests in MemoryRouter. */
export default function App({ api, initial }: { api: PostsApi; initial: InitialState | null }) {
  return (
    <BlogProvider api={api} initial={initial}>
      <Layout>
        <Routes>
          <Route path="/" element={<IndexPage />} />
          <Route path="/:slug" element={<PostPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BlogProvider>
  );
}

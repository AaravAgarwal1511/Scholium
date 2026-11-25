import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-display font-bold">Post not found</h1>
      <p className="mt-3 text-muted-foreground">It may have been moved or unpublished.</p>
      <p className="mt-6">
        <Link to="/" className="underline underline-offset-4">
          See all posts
        </Link>
      </p>
    </div>
  );
}

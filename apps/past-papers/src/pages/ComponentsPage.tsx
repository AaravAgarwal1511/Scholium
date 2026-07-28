import { Navigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import FolderCard from "@/components/FolderCard";
import Crumbs from "@/components/Crumbs";
import { LoadingGrid, ErrorState, EmptyState } from "@/components/StateViews";
import { useAsync } from "@/hooks/useAsync";
import { isSubjectDisabled, listComponents, subjectDisplayName } from "@/lib/papers";

const ACCENT_CYCLE = ["primary", "accent", "success"] as const;

export default function ComponentsPage() {
  const { subject = "" } = useParams();
  const subjectName = decodeURIComponent(subject);
  // A hidden subject is absent from the index, but its URL is still routable —
  // send anyone holding an old link back to the list rather than rendering it.
  const disabled = isSubjectDisabled(subjectName);

  const { data, loading, error } = useAsync(
    () => (disabled ? Promise.resolve([]) : listComponents(subjectName)),
    [subjectName, disabled]
  );

  if (disabled) return <Navigate to="/" replace />;

  return (
    <Layout subtitle="Pick a paper component to see its chapter-wise compilations.">
      <div className="mb-4">
        <Crumbs
          items={[
            { label: "Subjects", to: "/" },
            { label: subjectDisplayName(subjectName) },
          ]}
        />
      </div>

      <h2 className="font-display font-bold text-2xl text-foreground mb-6">
        {subjectDisplayName(subjectName)}
      </h2>

      {loading && <LoadingGrid count={4} />}
      {error && <ErrorState error={error} />}
      {!loading && !error && data && data.length === 0 && (
        <EmptyState
          title="No components yet"
          hint={`Add a folder under "${subjectName}" in the papers bucket to see it here.`}
        />
      )}
      {!loading && !error && data && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((component, i) => (
            <FolderCard
              key={component}
              to={`/${encodeURIComponent(subjectName)}/${encodeURIComponent(component)}`}
              title={component}
              subtitle="Compilation by chapter"
              accent={ACCENT_CYCLE[i % ACCENT_CYCLE.length]}
            />
          ))}
        </div>
      )}
    </Layout>
  );
}

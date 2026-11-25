export function StatusMessage({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="py-12 text-center text-muted-foreground">
      {children}
    </p>
  );
}

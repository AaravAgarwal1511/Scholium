import { Toaster as SonnerToaster } from "sonner";

const Toaster = (props: React.ComponentProps<typeof SonnerToaster>) => (
  <SonnerToaster
    position="bottom-center"
    richColors
    closeButton={false}
    toastOptions={{
      style: {
        borderRadius: "0.75rem",
        fontWeight: 600,
      },
    }}
    {...props}
  />
);

export { Toaster };

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * `/` and `/:subject` are scholium-home routes; anything deeper
 * (`/biology/past-papers`) belongs to a tool zone and needs a full page load.
 */
export function useGoTo() {
  const navigate = useNavigate();
  return useCallback(
    (url: string) => {
      if (url.split("/").filter(Boolean).length <= 1) navigate(url);
      else window.location.assign(url);
    },
    [navigate],
  );
}

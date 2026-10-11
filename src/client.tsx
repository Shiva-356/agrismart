import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

// Gracefully handle dynamic import chunk errors (e.g., stale cache after restart or network blip)
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    console.warn("Vite preload error detected, reloading page...", event);
    window.location.reload();
  });

  window.addEventListener("error", (event) => {
    if (
      event?.message &&
      /failed to fetch dynamically imported module|importing a module script failed/i.test(
        event.message,
      )
    ) {
      const key = "agrismart_chunk_reload_lock";
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 5000) {
        sessionStorage.setItem(key, String(Date.now()));
        console.warn("Dynamic import failure caught, reloading to fetch fresh module chunks...");
        window.location.reload();
      }
    }
  });
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});

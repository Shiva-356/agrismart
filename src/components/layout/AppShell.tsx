import type { ReactNode } from "react";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { Navbar } from "@/components/layout/Navbar";
import { useT } from "@/i18n";
import { USING_DEMO_ADAPTERS } from "@/services";
import { cn } from "@/lib/utils";

/**
 * Global page frame: top navbar, constrained content column, footer and a
 * mobile bottom tab bar.
 */
export function AppShell({
  children,
  navSlot,
  width = "default",
  className,
}: {
  children: ReactNode;
  navSlot?: ReactNode;
  width?: "default" | "wide" | "full";
  className?: string | undefined;
}) {
  const t = useT();
  const maxWidth = width === "full" ? "max-w-none" : width === "wide" ? "max-w-7xl" : "max-w-6xl";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:ring-2 focus:ring-ring"
      >
        {t.nav.skipToContent}
      </a>
      <Navbar slot={navSlot} />
      {USING_DEMO_ADAPTERS ? (
        <p className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-medium text-foreground">
          <span className="mr-2 rounded-full bg-amber-500/25 px-2 py-0.5 uppercase tracking-wide">
            {t.common.demoData}
          </span>
          {t.shell.demoNotice}
        </p>
      ) : null}
      <main
        id="main-content"
        className={cn(
          "mx-auto w-full flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pt-8 md:pb-12",
          maxWidth,
          className,
        )}
      >
        {children}
      </main>
      <footer className="border-t border-border py-8 pb-24 text-center text-sm text-muted-foreground md:pb-8">
        © {new Date().getFullYear()} {t.shell.tagline}
      </footer>
      <MobileNavigation />
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { MOBILE_NAV_ITEMS } from "@/components/layout/nav-items";
import { useAgriUser } from "@/hooks/use-agri-user";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * Bottom tab bar for small screens — a purpose-built mobile pattern rather
 * than a shrunken desktop nav. Hidden from md: upward.
 */
export function MobileNavigation({ className }: { className?: string }) {
  const user = useAgriUser();
  const t = useT();
  const items = MOBILE_NAV_ITEMS.filter((i) => user || !i.auth);

  if (items.length < 2) return null;

  return (
    <nav
      aria-label={t.nav.primaryMobile}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden",
        className,
      )}
    >
      <ul
        className="mx-auto grid max-w-md"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.6875rem] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[status=active]:text-primary"
            >
              <item.icon aria-hidden="true" className="size-5" />
              <span className="w-full truncate text-center">{t.navShort[item.key]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

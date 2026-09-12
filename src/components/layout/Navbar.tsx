import { Link, useNavigate } from "@tanstack/react-router";
import { Leaf, LogOut, User } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DESKTOP_NAV_ITEMS, NAV_ITEMS, PUBLIC_NAV_ITEMS } from "@/components/layout/nav-items";
import { LanguageSelector } from "@/components/layout/LanguageSelector";
import { NotificationsMenu } from "@/components/layout/NotificationsMenu";
import { useAgriUser } from "@/hooks/use-agri-user";
import { useT } from "@/i18n";
import { setUser } from "@/lib/agri";
import { cn } from "@/lib/utils";

/**
 * Desktop-first top navigation. On small screens it keeps brand, language,
 * notifications and profile, because primary navigation moves to
 * <MobileNavigation />.
 */
export function Navbar({ slot, className }: { slot?: ReactNode; className?: string }) {
  const user = useAgriUser();
  const navigate = useNavigate();
  const t = useT();

  const items = user ? DESKTOP_NAV_ITEMS : PUBLIC_NAV_ITEMS;
  const overflow = NAV_ITEMS.filter((i) => !items.includes(i) && (user || !i.auth));

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70",
        className,
      )}
    >
      <div className="mx-auto grid h-16 w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 sm:gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Leaf aria-hidden="true" className="size-5" />
            </span>
            <span className="truncate text-lg font-semibold tracking-tight">AgriSmart</span>
          </Link>

          <nav aria-label={t.nav.main} className="hidden items-center gap-0.5 lg:flex">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact ?? false }}
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[status=active]:bg-secondary data-[status=active]:text-foreground xl:px-3"
              >
                {t.nav[item.key]}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {slot}
          <LanguageSelector />
          {user ? (
            <>
              <NotificationsMenu />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t.nav.profile}
                    className="min-h-11 gap-2 rounded-full border border-border bg-card px-2 sm:px-3"
                  >
                    <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <User aria-hidden="true" className="size-3.5" />
                    </span>
                    <span className="hidden max-w-[9rem] truncate sm:inline">{user.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {overflow.map((item) => (
                    <DropdownMenuItem key={item.to} asChild>
                      <Link to={item.to}>{t.nav[item.key]}</Link>
                    </DropdownMenuItem>
                  ))}
                  {/* Destinations hidden from the compact bars stay reachable here. */}
                  <div className="lg:hidden">
                    {items
                      .filter((i) => !overflow.includes(i))
                      .map((item) => (
                        <DropdownMenuItem key={`m-${item.to}`} asChild>
                          <Link to={item.to}>{t.nav[item.key]}</Link>
                        </DropdownMenuItem>
                      ))}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      setUser(null);
                      navigate({ to: "/" });
                    }}
                  >
                    <LogOut aria-hidden="true" className="mr-2 size-4" />
                    {t.nav.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="min-h-11">
                <Link to="/login">{t.nav.login}</Link>
              </Button>
              <Button asChild size="sm" className="min-h-11">
                <Link to="/register">{t.nav.signUp}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

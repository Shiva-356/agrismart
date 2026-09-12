import { BellOff, BellRing } from "lucide-react";
import type { DataSource, Notification } from "@/services/types";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export function NotificationPanel({
  notifications,
  source,
  fetchedAt,
  onSelect,
  className,
}: {
  notifications: Notification[];
  source: DataSource;
  fetchedAt?: string | undefined;
  onSelect?: (n: Notification) => void;
  className?: string | undefined;
}) {
  const t = useT();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <section className={cn("card-surface p-5", className)} aria-labelledby="notifications-title">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2
            id="notifications-title"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            <BellRing aria-hidden="true" className="size-4" />
            {t.notifications.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {unread > 0 ? `${unread} ${t.notifications.unread}` : t.notifications.upToDate}
          </p>
        </div>
        <DataSourceBadge source={source} fetchedAt={fetchedAt} className="shrink-0" />
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          className="mt-4 border-0 bg-transparent px-0 py-8"
          icon={BellOff}
          title={t.notifications.empty}
          description={t.notifications.emptyHint}
        />
      ) : (
        <ul className="mt-4 divide-y divide-border/70">
          {notifications.map((n) => {
            const content = (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                  <p
                    className={cn(
                      "min-w-0 truncate text-sm",
                      n.read ? "font-medium text-muted-foreground" : "font-semibold text-foreground",
                    )}
                  >
                    {!n.read ? (
                      <span
                        aria-hidden="true"
                        className="mr-2 inline-block size-1.5 rounded-full bg-primary align-middle"
                      />
                    ) : null}
                    {n.title}
                  </p>
                  <time
                    dateTime={n.at}
                    className="shrink-0 text-xs tabular-nums text-muted-foreground"
                  >
                    {new Date(n.at).toLocaleDateString()}
                  </time>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{n.body}</p>
                {!n.read ? <span className="sr-only">{t.notifications.unread}</span> : null}
              </>
            );

            return (
              <li key={n.id}>
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(n)}
                    className="-mx-2 block w-[calc(100%+1rem)] rounded-xl px-2 py-3 text-left outline-none transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {content}
                  </button>
                ) : (
                  <div className="py-3">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

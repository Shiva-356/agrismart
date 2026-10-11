import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationPanel } from "@/components/agri/NotificationPanel";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { notificationsService } from "@/services";
import { useT } from "@/i18n";

export function NotificationsMenu() {
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsService.list(),
  });

  const unread = data?.data.filter((n) => !n.read).length ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.nav.notifications}
          className="relative min-h-11 min-w-11"
        >
          <Bell aria-hidden="true" className="size-4" />
          {unread > 0 ? (
            <span className="absolute right-2 top-2 flex size-2 rounded-full bg-primary" />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        {isLoading || !data ? (
          <div className="p-4">
            <LoadingSkeleton lines={3} />
          </div>
        ) : (
          <NotificationPanel
            notifications={data.data}
            source={data.source}
            fetchedAt={data.fetchedAt}
            className="border-0 shadow-none"
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

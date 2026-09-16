import type { LucideIcon } from "lucide-react";
import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { useT } from "@/i18n";

/** Placeholder for journey routes whose pages arrive in a later phase. */
export function ComingSoon({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) {
  const t = useT();
  return (
    <div className="space-y-8">
      <PageHeader
        title={title}
        {...(description ? { description } : {})}
        {...(icon ? { icon } : {})}
      />
      <EmptyState icon={Hammer} title={t.pages.preparing} description={t.pages.preparingHint} />
    </div>
  );
}

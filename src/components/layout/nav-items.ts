import {
  BarChart3,
  FlaskConical,
  History,
  LayoutDashboard,
  Leaf,
  Sprout,
  TestTubes,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Dictionary } from "@/i18n";

export type NavKey = keyof Dictionary["nav"] & keyof Dictionary["navShort"];

export type NavItem = {
  to: string;
  key: NavKey;
  icon: LucideIcon;
  exact?: boolean;
  /** Shown only to signed-in farmers. */
  auth?: boolean;
  /** Included in the mobile bottom tab bar. */
  mobile?: boolean;
};

/** Every destination the global shell can link to. */
export const NAV_ITEMS: NavItem[] = [
  { to: "/", key: "home", icon: Sprout, exact: true, mobile: true },
  { to: "/dashboard", key: "dashboard", icon: LayoutDashboard, auth: true, mobile: true },
  { to: "/soil-testing", key: "soilTesting", icon: TestTubes, auth: true, mobile: true },
  { to: "/recommendations", key: "recommendations", icon: Leaf, auth: true, mobile: true },
  { to: "/cultivation", key: "cultivation", icon: Sprout, auth: true },
  { to: "/history", key: "history", icon: History, auth: true, mobile: true },
  { to: "/soil-analysis", key: "soilAnalyzer", icon: FlaskConical, auth: true },
  { to: "/ml-evaluation", key: "mlEvaluation", icon: BarChart3 },
];

export const DESKTOP_NAV_ITEMS = NAV_ITEMS.filter((i) => i.key !== "soilAnalyzer");
export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((i) => i.mobile);

/** Public navigation for signed-out visitors. */
export const PUBLIC_NAV_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (i) => !i.auth && i.key !== "mlEvaluation",
);

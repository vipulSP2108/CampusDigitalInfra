import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveCategories } from "@/lib/categories/categoryService";
import { getCurrentUser } from "@/lib/auth/session";
import {
  Home,
  Building2,
  BedDouble,
  GraduationCap,
  Landmark,
  ArrowRight,
  Wrench,
  Sparkles,
  Coffee,
  Dumbbell,
  Stethoscope,
  Trees,
  Wifi,
  Laptop,
  BookOpen,
  HeartPulse,
  Bus,
  Layers,
  Store,
  ShieldCheck,
  Search,
  CheckCircle2,
  Clock,
  Camera,
  MessageSquare,
  MessageCircle,
} from "lucide-react";

// Map string icon names to Lucide icon components
const ICON_MAP: Record<string, any> = {
  Home,
  Building2,
  BedDouble,
  GraduationCap,
  Landmark,
  Wrench,
  Sparkles,
  Coffee,
  Dumbbell,
  Stethoscope,
  Trees,
  Wifi,
  Laptop,
  BookOpen,
  HeartPulse,
  Bus,
  Layers,
  Store,
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, currentUser] = await Promise.all([
    getActiveCategories(),
    getCurrentUser(),
  ]);

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Banner Section matching Sample IITGN Design */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white pt-8 sm:pt-12 pb-12 sm:pb-16 px-3.5 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:20px_20px]" />

        <div className="relative max-w-5xl mx-auto text-center space-y-4 sm:space-y-6">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-white/10 border border-white/15 text-indigo-200 text-[10px] sm:text-xs font-semibold backdrop-blur-md max-w-full">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="hidden sm:inline">Digital Infra • IIT Gandhinagar Maintenance & Operations Portal</span>
            <span className="sm:hidden truncate">Digital Infra • IITGN Maintenance</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Institute Works Department <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-indigo-200 to-teal-200">
              Campus Maintenance & Facility Redressal
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-slate-300 text-xs sm:text-base leading-relaxed px-2">
            Submit maintenance complaints across student hostels, staff housing, academic blocks, and campus facilities.
          </p>

          {/* Quick Track Input Bar */}
          <div className="max-w-lg mx-auto pt-2 space-y-2">
            <form
              action="/track"
              method="GET"
              className="flex items-center rounded-xl bg-white dark:bg-slate-900/90 p-1.5 shadow-2xl shadow-indigo-950/60 border border-white/20 dark:border-slate-700 backdrop-blur-md"
            >
              <div className="pl-3 text-slate-400 dark:text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                name="q"
                placeholder="Enter Ticket ID (e.g. IITGN-2026-0001)..."
                style={{ backgroundColor: "transparent" }}
                className="w-full px-3 py-1.5 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm focus:outline-hidden !bg-transparent dark:!bg-transparent border-none outline-none ring-0 shadow-none font-medium"
                required
              />
              <button
                type="submit"
                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm px-4 py-2 rounded-lg transition-all shadow-md shadow-indigo-500/30 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Track</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Quick Chat Shortcut for Mobile Users */}
            {/* <div className="flex justify-center pt-1">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-indigo-200 text-xs font-semibold backdrop-blur-sm transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5 text-indigo-300" />
                <span>Have an active complaint? Open Live Chat →</span>
              </Link>
            </div> */}
          </div>
        </div>
      </section>

      {/* Main Categories Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 gap-3 sm:gap-4">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Submit a Maintenance Complaint
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1">
              Select your location category to open the unified request form with cascading fault diagnostics.
            </p>
          </div>
          {currentUser ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 text-xs font-semibold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Signed in: <strong>{currentUser.name}</strong> ({currentUser.roleCode === "PUBLIC" ? "Campus Resident (Student/Faculty)" : (currentUser.roleName || "Campus Resident")})</span>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-indigo-300 transition-colors"
            >
              <span>Have an IITGN Account? Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => {
            const IconComp = ICON_MAP[cat.icon] || Home;
            return (
              <Link
                key={cat.slug}
                href={`/new/${cat.slug}`}
                className="group relative bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-xs">
                    <IconComp className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                    {cat.shortDescription}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {cat.allowedDomains.slice(0, 4).map((d) => (
                      <span
                        key={d}
                        className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md"
                      >
                        {d}
                      </span>
                    ))}
                    {cat.allowedDomains.length > 4 && (
                      <span className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md">
                        +{cat.allowedDomains.length - 4}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                  <span>Open Request Form</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

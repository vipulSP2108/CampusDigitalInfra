"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, X, ArrowLeft, Building2, ShieldCheck, UserCheck, HelpCircle } from "lucide-react";
import { PUBLIC_ACCOUNTS } from "@/config/publicAccounts";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  // Mobile slide state (0 = Sign In Form, 1 = Campus Info). Starts at 1 (Campus Info) by default on mobile.
  const [mobileSlide, setMobileSlide] = useState<0 | 1>(1);

  async function handleLoginWithCredentials(targetEmail: string, targetPassword?: string) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPassword || password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (
          data.user?.roleCode === "OVERALL_ADMIN" ||
          data.user?.roleCode === "DEPT_ADMIN" ||
          data.user?.roleCode === "DEPT_STAFF"
        ) {
          window.location.href = "/admin";
        } else {
          window.location.href = "/";
        }
      } else {
        setError(data.message || "Invalid credentials or account not found.");
      }
    } catch {
      setError("Unable to reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Please enter your Internet ID / IITGN Email");
      return;
    }
    await handleLoginWithCredentials(email, password);
  }

  // Selecting an account only prefills the email — the password is never stored
  // in the client bundle and must be entered by the user.
  const handleSelectAccount = (accEmail: string) => {
    setEmail(accEmail);
    setPassword("");
    setShowAccountsModal(false);
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden flex items-center justify-center p-3 sm:p-4 select-none">
      {/* Background Campus/Canopy Artwork contained in overflow-hidden */}
      <div className="absolute inset-0 overflow-hidden -z-20 pointer-events-none">
        <div
          className="w-full h-full bg-cover bg-center filter brightness-75 scale-105"
          style={{ backgroundImage: "url('/iitgn-campus.jpg')" }}
        />
      </div>
      {/* Deep blue tinted overlay with lattice pattern */}
      <div className="absolute inset-0 bg-[#071739]/85 backdrop-blur-[2px] -z-10" />

      {/* Top Left Home Link */}
      <div className="absolute top-3 sm:top-5 left-3 sm:left-6 z-20">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 sm:px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/15 transition-all shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Back to Maintenance Portal</span>
          <span className="xs:hidden">Portal</span>
        </Link>
      </div>

      {/* Top Right Demo Logins Trigger */}
      <div className="absolute top-3 sm:top-5 right-3 sm:right-6 z-20">
        <button
          type="button"
          onClick={() => setShowAccountsModal(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600/90 hover:bg-blue-600 px-3 sm:px-3.5 py-1.5 rounded-lg backdrop-blur-md border border-blue-400/40 transition-all shadow-md cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Demo Logins</span>
        </button>
      </div>

      {/* Main Container Card - fits squarely without scrolling */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-3xl flex flex-col items-center my-auto">
        {/* Dual Pane Auth Card matching INAS layout */}
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:flex-row border border-slate-200/80 dark:border-slate-800 transition-colors">
          {/* Left Side: IITGN Emblem & Photo Banner (Desktop: always visible left; Mobile: visible when slide === 1, default) */}
          <div
            className={`relative sm:w-5/12 bg-gradient-to-b from-[#004e92] to-[#000428] text-white p-5 sm:p-8 flex-col justify-between items-center text-center overflow-hidden min-h-0 sm:min-h-[420px] ${mobileSlide === 1 ? "flex" : "hidden sm:flex"
              }`}
          >
            {/* Subtle background photo */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay pointer-events-none"
              style={{ backgroundImage: "url('/iitgn-campus.jpg')" }}
            />
            <div className="relative z-10 flex flex-col items-center my-auto space-y-3 sm:space-y-4">
              {/* Round White Logo Badge */}
              <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-white/10 p-2 sm:p-2.5 backdrop-blur-xs border border-white/30 flex items-center justify-center shadow-lg">
                <img
                  src="/iitgn-logo.svg"
                  alt="IIT Gandhinagar Logo"
                  className="w-full h-full object-contain filter drop-shadow"
                />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-wide text-white">
                  IIT Gandhinagar
                </h2>
                <p className="text-[10px] sm:text-[11px] text-blue-200 uppercase tracking-widest mt-0.5 font-medium">
                  Institute Works Department
                </p>
              </div>

              {/* Mobile Action to proceed to Sign In Form */}
              <button
                type="button"
                onClick={() => setMobileSlide(0)}
                className="sm:hidden mt-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition-all shadow-md border border-blue-400/40 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Go to Sign In Form</span>
                <span>&rarr;</span>
              </button>
            </div>

            <div className="relative z-10 text-[10px] text-blue-100/80 pt-3 sm:pt-4 leading-tight">
              <span>For support, please contact:</span>
              <br />
              <a
                href="mailto:helpdesk.istf@iitgn.ac.in"
                className="font-medium text-white hover:underline"
              >
                helpdesk.istf@iitgn.ac.in
              </a>
            </div>
          </div>

          {/* Right Side: INAS Style Clean Form (Desktop: always visible right; Mobile: visible when slide === 0) */}
          <div
            className={`sm:w-7/12 p-4 sm:p-10 flex-col justify-center bg-white dark:bg-slate-900 space-y-3 sm:space-y-5 transition-colors ${mobileSlide === 0 ? "flex" : "hidden sm:flex"
              }`}
          >
            <div className="text-center">
              <h1 className="text-xl sm:text-2xl font-black text-[#2563eb] dark:text-blue-400 tracking-tight">
                इनास / INAS
              </h1>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 tracking-wide mt-1">
                Institute Authentication Services
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4 pt-1">
              <div>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Internet ID"
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                />
              </div>

              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowAccountsModal(true)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium hover:underline text-xs cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              {error && (
                <div className="p-2.5 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-sm transition-all shadow-xs hover:shadow-md disabled:opacity-60 cursor-pointer"
              >
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            {/* Quick Demo Logins trigger link below button */}
            <div className="pt-2 text-center flex items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAccountsModal(true)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Demo Logins</span>
              </button>
              <span>•</span>
              {/* <button
                type="button"
                onClick={() => setMobileSlide(1)}
                className="sm:hidden text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:underline cursor-pointer"
              >
                Campus Info
              </button> */}
              {/* <span className="sm:hidden">•</span> */}
              <Link
                href="/"
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:underline"
              >
                Guest Filing
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Demo Logins */}
      {showAccountsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-5 space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Configured Accounts
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Select an account to prefill the email, then enter its password.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountsModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-[55vh] overflow-y-auto px-0.5">
              {PUBLIC_ACCOUNTS.map((user) => {
                const isRegularUser = user.roleCode === "PUBLIC";
                const badgeColor =
                  user.roleCode === "OVERALL_ADMIN"
                    ? "bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300"
                    : user.roleCode === "DEPT_ADMIN"
                      ? "bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300"
                      : user.roleCode === "DEPT_STAFF"
                        ? "bg-cyan-50 dark:bg-cyan-950/70 border-cyan-200 dark:border-cyan-900/60 text-cyan-700 dark:text-cyan-300"
                        : "bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300";

                return (
                  <button
                    key={user.email}
                    type="button"
                    onClick={() => handleSelectAccount(user.email)}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-slate-800 transition-all flex items-center justify-between group cursor-pointer shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {user.name}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badgeColor}`}>
                          {isRegularUser ? "Regular User" : user.roleName || user.roleCode}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {user.email}
                        {user.departmentName ? ` • ${user.departmentName}` : ""}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0 ml-2">
                      Use email &rarr;
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Passwords are never shown or stored in the browser</span>
              <button
                type="button"
                onClick={() => setShowAccountsModal(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

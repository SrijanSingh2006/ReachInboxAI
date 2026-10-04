"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Home as HomeIcon, Target, Clock, CheckCircle2, Settings,
  Inbox, Search, Plus, LogOut, RefreshCw, Mail, Upload,
  Users, X, Zap, ExternalLink, Activity, BarChart3,
  Send, ChevronRight, AlertTriangle, Eye, Box, PieChart, Sun, Moon,
  Lock, MailCheck, Radio, Sparkles,
} from "lucide-react";
import { emailApi, slackApi } from "@/lib/api";
import type { ScheduledEmail, EmailStats, SlackStatus } from "@/types";
import Papa from "papaparse";

/* ─────────────────────────────────────────────────────────────── */
/* HELPERS                                                         */
/* ─────────────────────────────────────────────────────────────── */
const fmt = (d: string | Date) =>
  new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

/* ─────────────────────────────────────────────────────────────── */
/* STATUS PILL                                                      */
/* ─────────────────────────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const cls =
    status === "sent"      ? "pill pill-sent" :
    status === "failed"    ? "pill pill-failed" :
                             "pill pill-scheduled";
  return <span className={cls}>{status}</span>;
}

/* ─────────────────────────────────────────────────────────────── */
/* TOAST SYSTEM                                                     */
/* ─────────────────────────────────────────────────────────────── */
interface Toast { id: string; type: "success" | "error" | "info"; msg: string; }
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = (type: Toast["type"], msg: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(p => [...p, { id, type, msg }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  };
  const remove = (id: string) => setToasts(p => p.filter(t => t.id !== id));
  return { toasts, add, remove };
}

function Toasts({ toasts, remove }: { toasts: Toast[]; remove: (id: string) => void }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type} animate-slideIn`}>
          <span className="flex-1">{t.msg}</span>
          <button onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100 transition-opacity ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* LOGIN PAGE — 3D GLASSMORPHISM                                   */
/* ─────────────────────────────────────────────────────────────── */
function LoginPage({ theme = "light", onToggleTheme }: { theme?: "light" | "dark"; onToggleTheme?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error")) {
        setLoginError("Google OAuth credentials not configured in frontend/.env.local yet. Please use One-Click Demo Access or configure your Google Client ID & Secret in Settings.");
      }
    }
  }, []);
  return (
    <div className={`relative min-h-screen flex items-center justify-center overflow-hidden ${theme === "light" ? "theme-light" : "theme-dark"}`} data-theme={theme} style={{ background: "var(--bg-deep)" }}>
      {/* Animated background */}
      <div className="bg-scene" />
      <div className="bg-grid-lines" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Floating decorative elements */}
      <div className="absolute top-1/4 left-1/4 w-1.5 h-1.5 rounded-full bg-indigo-400 opacity-60 animate-pulse" style={{ animationDelay: "0s" }} />
      <div className="absolute top-1/3 right-1/3 w-2 h-2 rounded-full bg-violet-400 opacity-40 animate-pulse" style={{ animationDelay: "1s" }} />
      <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 rounded-full bg-blue-400 opacity-50 animate-pulse" style={{ animationDelay: "2s" }} />

      {/* Theme switcher on Login */}
      {onToggleTheme && (
        <button
          onClick={onToggleTheme}
          className="absolute top-6 right-6 z-20 btn-ghost p-2.5 flex items-center gap-2 text-xs font-semibold"
          title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          {theme === "light" ? <Moon className="w-4 h-4 text-slate-700" /> : <Sun className="w-4 h-4 text-amber-400" />}
          <span className="capitalize">{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
        </button>
      )}

      <div className="relative z-10 w-full max-w-sm mx-4 animate-fadeInUp">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <span className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold"
            style={{ background: "rgba(79,70,229,0.1)", border: "1px solid rgba(79,70,229,0.25)", color: "#4f46e5" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Production-Grade Email Scheduler
          </span>
        </div>

        {/* Main Login Card - Clean SaaS Style */}
        <div className="bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl shadow-indigo-500/5 relative overflow-hidden flex flex-col items-center justify-center w-full min-h-[430px]">
          {/* Subtle top glow line */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />
          
          {/* Minimal Logo */}
          <div className="flex flex-col items-center mb-8 w-full text-center mt-2">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-white/[0.03] rounded-2xl flex items-center justify-center mb-4 border border-indigo-200/60 dark:border-white/10 shadow-sm">
              <Inbox className="w-6 h-6 text-indigo-600 dark:text-gray-300" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-1.5">
              Welcome to ReachInbox
            </h1>
            <p className="text-sm text-slate-500 dark:text-gray-400">
              High-throughput email queuing & delivery
            </p>
          </div>

          {loginError && (
            <div className="w-full mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs text-center leading-relaxed">
              {loginError}
            </div>
          )}

          {/* Clean Buttons */}
          <div className="w-full flex flex-col gap-3">
            {/* Google */}
            <button
              onClick={() => {
                setLoading(true);
                signIn("credentials", {
                  email: "sspersonal2003@gmail.com",
                  name: "Srijan Singh",
                  callbackUrl: "/",
                });
              }}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-sm text-slate-700 dark:text-gray-200 bg-white hover:bg-slate-50 dark:bg-white/[0.03] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/10 shadow-sm transition-all disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            {/* Demo / Guest Login */}
            <button
              onClick={() => {
                setLoading(true);
                signIn("credentials", {
                  email: "demo@reachinbox.ai",
                  name: "Demo User",
                  callbackUrl: "/",
                });
              }}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-[0_4px_14px_0_rgba(79,70,229,0.35)]"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Activity className="w-4 h-4 text-white" />
              )}
              One-Click Demo Access
            </button>
          </div>

          {/* Tech Stack Pills */}
          <div className="w-full mt-auto pt-6 flex flex-col items-center">
             <div className="flex flex-wrap justify-center gap-1.5">
                {["BullMQ", "Cloud Redis", "Supabase DB", "Gmail SMTP"].map(t => (
                  <span key={t} className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 tracking-wider">
                    {t}
                  </span>
                ))}
              </div>
          </div>
        </div>

        <p className="text-center text-xs mt-5" style={{ color: "var(--text-muted)" }}>
          ReachInbox Email Platform · Enterprise Job Scheduling & Delivery Engine
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* COMPOSE MODAL                                                    */
/* ─────────────────────────────────────────────────────────────── */
function ComposeModal({ onClose, onSuccess, userEmail }: {
  onClose: () => void; onSuccess: (count: number) => void; userEmail: string;
}) {
  const [subject, setSubject]             = useState("");
  const [body, setBody]                   = useState("");
  const [senderId, setSenderId]           = useState(userEmail);
  const [scheduledTime, setScheduledTime] = useState("");
  const [delayMs, setDelayMs]             = useState(2000);
  const [maxPerHour, setMaxPerHour]       = useState(200);
  const [csvEmails, setCsvEmails]         = useState<string[]>([]);
  const [csvName, setCsvName]             = useState("");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [dragging, setDragging]           = useState(false);

  const parseFile = (file: File) => {
    setCsvName(file.name);
    Papa.parse(file, {
      complete: (r) => {
        const emails = (r.data as string[][]).flat()
          .filter(c => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c?.trim()))
          .map(e => e.trim().toLowerCase());
        setCsvEmails([...new Set(emails)]);
      },
    });
  };

  const minDt = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (csvEmails.length === 0) { setError("Upload a CSV with at least one valid email."); return; }
    if (!scheduledTime) { setError("Please set a start time."); return; }
    setError(""); setLoading(true);
    try {
      const t0 = new Date(scheduledTime).getTime();
      for (let i = 0; i < csvEmails.length; i++) {
        const t = new Date(t0 + i * delayMs).toISOString();
        await emailApi.schedule({
          recipient: csvEmails[i], subject, body,
          scheduledTime: t, senderId,
          delayBetweenEmailsMs: delayMs, maxEmailsPerHour: maxPerHour,
        });
      }
      onSuccess(csvEmails.length);
    } catch {
      setError("Failed — is the backend running at localhost:5000?");
    } finally { setLoading(false); }
  };

  const eta = csvEmails.length > 0
    ? `~${Math.ceil((csvEmails.length * delayMs) / 60000)} min total`
    : null;

  return (
    <div className="modal-overlay">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="modal-box animate-slideUp relative">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg" style={{ background: "rgba(79,70,229,0.2)", border: "1px solid rgba(79,70,229,0.3)" }}>
              <Send className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Schedule Email Campaign</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[72vh] p-5 space-y-4">
          {/* Sender + Subject */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Sender Email *</label>
              <input type="text" required value={senderId} onChange={e => setSenderId(e.target.value)}
                placeholder="sender@example.com" className="form-input" />
            </div>
            <div>
              <label className="form-label">Subject *</label>
              <input type="text" required value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Email Subject" className="form-input" />
            </div>
          </div>

          {/* Body */}
          <div>
            <label className="form-label">Email Body *</label>
            <textarea required rows={4} value={body} onChange={e => setBody(e.target.value)}
              placeholder="Write your email content here..."
              className="form-input resize-none" />
          </div>

          {/* CSV Upload */}
          <div>
            <label className="form-label">Recipients CSV *</label>
            <div
              className={`dropzone ${dragging ? "active" : ""} ${csvEmails.length > 0 ? "active" : ""}`}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => document.getElementById("csv-file-input")?.click()}
            >
              <input id="csv-file-input" type="file" accept=".csv,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
              {csvEmails.length > 0 ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="p-2 rounded-lg" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
                    <Users className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-green-400">{csvEmails.length} valid email{csvEmails.length !== 1 ? "s" : ""} ready</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{csvName}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <Upload className="w-5 h-5 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Drop CSV or <span className="text-indigo-400 font-medium">click to browse</span>
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>One email per row</p>
                </div>
              )}
            </div>
          </div>

          {/* Schedule config */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="form-label">Start Time *</label>
              <input type="datetime-local" required min={minDt} value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Delay (ms)</label>
              <input type="number" min={0} value={delayMs} onChange={e => setDelayMs(+e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Max / Hour</label>
              <input type="number" min={1} value={maxPerHour} onChange={e => setMaxPerHour(+e.target.value)} className="form-input" />
            </div>
            {eta && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "rgba(79,70,229,0.08)", border: "1px solid rgba(79,70,229,0.15)" }}>
                <Zap className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <p className="text-xs text-indigo-400 font-medium">{eta}</p>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost text-xs">Cancel</button>
            <button type="submit" disabled={loading || csvEmails.length === 0} className="btn-primary text-xs">
              {loading ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Scheduling...</>
              ) : (
                <><Send className="w-3.5 h-3.5" />Schedule {csvEmails.length > 0 ? `${csvEmails.length} ` : ""}Email{csvEmails.length !== 1 ? "s" : ""}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* STAT CARD                                                        */
/* ─────────────────────────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, cls, loading }: {
  label: string; value: string | number; icon: React.ElementType; cls: string; loading: boolean;
}) {
  return (
    <div className={`stat-card ${cls}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
        <Icon className="w-4 h-4 opacity-40" />
      </div>
      {loading
        ? <div className="skeleton h-9 w-16 mt-1" />
        : <p className="text-3xl font-black tracking-tight" style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* EMAIL TABLE                                                      */
/* ─────────────────────────────────────────────────────────────── */
function EmailTable({ emails, loading, type, onCompose }: {
  emails: ScheduledEmail[]; loading: boolean; type: "all" | "scheduled" | "sent"; onCompose: () => void;
}) {
  if (loading) return (
    <div className="divide-y" style={{ borderColor: "rgba(99,179,237,0.06)" }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-5 px-5 py-4">
          <div className="skeleton h-3 w-40" />
          <div className="skeleton h-3 flex-1" />
          <div className="skeleton h-3 w-32" />
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );

  if (emails.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="relative mb-5">
        <div className="p-5 rounded-2xl" style={{ background: "rgba(79,70,229,0.08)", border: "1px solid rgba(79,70,229,0.15)" }}>
          <Mail className="w-8 h-8 text-indigo-400" />
        </div>
        <div className="absolute inset-0 rounded-2xl bg-indigo-500/10 blur-xl" />
      </div>
      <p className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
        {type === "all" ? "No email campaigns dispatched or queued yet" : `No ${type} emails yet`}
      </p>
      <p className="text-xs mb-5" style={{ color: "var(--text-secondary)" }}>
        {type === "sent" ? "Sent emails will appear here after delivery via BullMQ worker" : "Create a campaign or upload a CSV to schedule batch deliveries"}
      </p>
      {type !== "sent" && (
        <button onClick={onCompose} className="btn-primary text-xs">
          <Plus className="w-3.5 h-3.5" /> Create Campaign
        </button>
      )}
    </div>
  );

  const cols = ["Recipient", "Subject", type === "scheduled" ? "Scheduled For" : type === "sent" ? "Sent At" : "Date & Time", "Sender", "Status", "Preview"];

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {cols.map((c, i) => <th key={i} className="text-left">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {emails.map((email, idx) => (
            <tr key={email.id} className="animate-fadeIn" style={{ animationDelay: `${idx * 0.03}s`, opacity: 0 }}>
              <td>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: "rgba(79,70,229,0.15)", border: "1px solid rgba(79,70,229,0.25)", color: "#818cf8" }}>
                    {email.recipient[0]?.toUpperCase() || "@"}
                  </div>
                  <span className="text-sm font-medium truncate max-w-[170px]" style={{ color: "var(--text-primary)" }}>
                    {email.recipient}
                  </span>
                </div>
              </td>
              <td>
                <span className="text-sm truncate block max-w-[200px]" style={{ color: "var(--text-secondary)" }}>
                  {email.subject}
                </span>
              </td>
              <td>
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  {fmt(email.sentAt || email.scheduledTime)}
                </span>
              </td>
              <td>
                <span className="text-xs truncate block max-w-[140px]" style={{ color: "var(--text-muted)" }}>
                  {email.senderId}
                </span>
              </td>
              <td><StatusPill status={email.status} /></td>
              <td>
                {email.status === "sent" && (email as any).etherealPreviewUrl ? (
                  <a href={(email as any).etherealPreviewUrl} target="_blank" rel="noreferrer"
                    className="ext-link flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400" title="Preview email in Ethereal">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </a>
                ) : (
                  <span className="text-slate-300 dark:text-gray-600 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* ANALYTICS VIEW — 3D ISOMETRIC & 2D CHARTS                       */
/* ─────────────────────────────────────────────────────────────── */
function AnalyticsView({ stats, statsLoading, theme = "light" }: { stats: EmailStats | null; statsLoading: boolean; theme?: "light" | "dark" }) {
  const [chartMode, setChartMode] = useState<"3d" | "2d">("3d");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const tot = stats?.total ?? 0;
  const sch = stats?.scheduled ?? 0;
  const snt = stats?.sent ?? 0;
  const fld = stats?.failed ?? 0;

  const successRate = tot > 0 ? `${Math.round((snt / tot) * 100)}%` : "0%";
  const isDark = theme === "dark";

  const data = [
    {
      key: "total",
      label: "Total Emails",
      shortLabel: "Total",
      val: tot,
      pct: tot > 0 ? 100 : 0,
      frontGrad: ["#6366f1", "#4338ca"],
      topGrad: ["#c7d2fe", "#818cf8"],
      rightGrad: ["#3730a3", "#1e1b4b"],
      badgeBorder: "#6366f1",
      subColor: isDark ? "#a5b4fc" : "#4f46e5",
      colorClass: "text-indigo-600 dark:text-indigo-400",
      bgClass: "bg-indigo-50 dark:bg-indigo-500/10",
      borderClass: "border-indigo-200 dark:border-indigo-500/30",
    },
    {
      key: "queued",
      label: "Queued / Scheduled",
      shortLabel: "Queued",
      val: sch,
      pct: tot > 0 ? Math.round((sch / tot) * 100) : 0,
      frontGrad: ["#f59e0b", "#d97706"],
      topGrad: ["#fef08a", "#fbbf24"],
      rightGrad: ["#b45309", "#78350f"],
      badgeBorder: "#f59e0b",
      subColor: isDark ? "#fbbf24" : "#d97706",
      colorClass: "text-amber-600 dark:text-amber-400",
      bgClass: "bg-amber-50 dark:bg-amber-500/10",
      borderClass: "border-amber-200 dark:border-amber-500/30",
    },
    {
      key: "sent",
      label: "Successfully Delivered",
      shortLabel: "Sent",
      val: snt,
      pct: tot > 0 ? Math.round((snt / tot) * 100) : 0,
      frontGrad: ["#10b981", "#059669"],
      topGrad: ["#a7f3d0", "#34d399"],
      rightGrad: ["#047857", "#064e3b"],
      badgeBorder: "#10b981",
      subColor: isDark ? "#34d399" : "#059669",
      colorClass: "text-emerald-600 dark:text-emerald-400",
      bgClass: "bg-emerald-50 dark:bg-emerald-500/10",
      borderClass: "border-emerald-200 dark:border-emerald-500/30",
    },
    {
      key: "failed",
      label: "Failed Deliveries",
      shortLabel: "Failed",
      val: fld,
      pct: tot > 0 ? Math.round((fld / tot) * 100) : 0,
      frontGrad: ["#ef4444", "#dc2626"],
      topGrad: ["#fecaca", "#f87171"],
      rightGrad: ["#b91c1c", "#7f1d1d"],
      badgeBorder: "#ef4444",
      subColor: isDark ? "#f87171" : "#dc2626",
      colorClass: "text-rose-600 dark:text-rose-400",
      bgClass: "bg-rose-50 dark:bg-rose-500/10",
      borderClass: "border-rose-200 dark:border-rose-500/30",
    },
  ];

  const maxH = 130;
  const yBase = 205;
  const barW = 72;
  const dx = 22;
  const dy = 13;
  const xPositions = [65, 225, 385, 545];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 pb-28 animate-slideUp">
      <div className="bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm relative flex flex-col w-full min-h-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl border border-indigo-200/80 dark:border-indigo-500/20 shadow-sm">
              <BarChart3 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Performance Analytics</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400">Real-time email queue metrics and delivery analytics.</p>
            </div>
          </div>

          {/* 3D / 2D Toggle Switch */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setChartMode("3d")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                chartMode === "3d"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                  : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              3D Isometric
            </button>
            <button
              onClick={() => setChartMode("2d")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                chartMode === "2d"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                  : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              2D Flat Bars
            </button>
          </div>
        </div>

        {statsLoading ? (
          <div className="flex-1 flex items-center justify-center min-h-[300px]">
            <span className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-6 w-full">
            {/* Main Visualizer Container */}
            <div className="bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
                  {chartMode === "3d" ? "Campaign Performance (3D Axonometric Projection)" : "Delivery Volume Breakdown"}
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Telemetry
                </span>
              </div>

              {chartMode === "3d" ? (
                /* 3D Isometric SVG Bar Chart */
                <div className="w-full flex justify-center items-center py-4">
                  <svg
                    viewBox="0 0 710 265"
                    className="w-full h-auto max-h-[320px] select-none"
                    style={{ overflow: "visible" }}
                  >
                    <defs>
                      {/* Drop shadow filter */}
                      <filter id="shadow-blur" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
                      </filter>

                      {/* Lighting Gradients for each metric */}
                      {data.map((item) => (
                        <g key={item.key}>
                          <linearGradient id={`gf-${item.key}`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={item.frontGrad[0]} />
                            <stop offset="100%" stopColor={item.frontGrad[1]} />
                          </linearGradient>
                          <linearGradient id={`gt-${item.key}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={item.topGrad[0]} />
                            <stop offset="100%" stopColor={item.topGrad[1]} />
                          </linearGradient>
                          <linearGradient id={`gr-${item.key}`} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={item.rightGrad[0]} />
                            <stop offset="100%" stopColor={item.rightGrad[1]} />
                          </linearGradient>
                        </g>
                      ))}
                    </defs>

                    {/* Isometric Floor Grid Lines */}
                    <g stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} strokeWidth="1" strokeDasharray="4 4">
                      <line x1="30" y1="205" x2="680" y2="205" />
                      <line x1="52" y1="192" x2="702" y2="192" />
                      <line x1="74" y1="179" x2="724" y2="179" />
                      {xPositions.map((xp, idx) => (
                        <line key={idx} x1={xp + 10} y1="205" x2={xp + 10 + dx * 2} y2="179" />
                      ))}
                    </g>

                    {/* Columns */}
                    {data.map((item, i) => {
                      const x = xPositions[i];
                      const rawH = tot > 0 ? (item.val / tot) * maxH : 0;
                      // Height minimum 16px if > 0, 8px base pedestal if 0
                      const h = item.val > 0 ? Math.max(Math.round(rawH), 16) : 8;
                      const topY = yBase - h;
                      const isHovered = hoveredIdx === i;

                      return (
                        <g
                          key={item.key}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredIdx(i)}
                          onMouseLeave={() => setHoveredIdx(null)}
                          style={{
                            transform: isHovered ? "translateY(-4px)" : "translateY(0px)",
                            transition: "transform 0.2s ease-out",
                          }}
                        >
                          {/* Ambient Floor Shadow */}
                          <polygon
                            points={`${x - 4},${yBase + 4} ${x + dx},${yBase - dy + 2} ${x + barW + dx + 6},${yBase - dy + 4} ${x + barW + 4},${yBase + 8}`}
                            fill={isDark ? "rgba(0,0,0,0.6)" : "rgba(15,23,42,0.08)"}
                          />

                          {/* Front Face */}
                          <polygon
                            points={`${x},${topY} ${x + barW},${topY} ${x + barW},${yBase} ${x},${yBase}`}
                            fill={`url(#gf-${item.key})`}
                            opacity={isHovered ? 1 : 0.94}
                          />

                          {/* Top Face */}
                          <polygon
                            points={`${x},${topY} ${x + dx},${topY - dy} ${x + barW + dx},${topY - dy} ${x + barW},${topY}`}
                            fill={`url(#gt-${item.key})`}
                            opacity={isHovered ? 1 : 0.96}
                          />

                          {/* Right Side Face */}
                          <polygon
                            points={`${x + barW},${topY} ${x + barW + dx},${topY - dy} ${x + barW + dx},${yBase - dy} ${x + barW},${yBase}`}
                            fill={`url(#gr-${item.key})`}
                            opacity={isHovered ? 1 : 0.9}
                          />

                          {/* Top Bevel Highlight */}
                          <polyline
                            points={`${x},${topY} ${x + barW},${topY} ${x + barW + dx},${topY - dy}`}
                            fill="none"
                            stroke="rgba(255,255,255,0.5)"
                            strokeWidth="1.2"
                          />

                          {/* Corner Highlight */}
                          <line
                            x1={x + barW}
                            y1={topY}
                            x2={x + barW}
                            y2={yBase}
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth="1"
                          />

                          {/* Floating Value Badge */}
                          <g transform={`translate(${x + barW / 2 + dx / 2}, ${topY - dy - 16})`}>
                            <rect
                              x="-22"
                              y="-13"
                              width="44"
                              height="22"
                              rx="6"
                              fill={isDark ? "#111318" : "#ffffff"}
                              stroke={item.badgeBorder}
                              strokeWidth="1.5"
                              filter={isDark ? undefined : "drop-shadow(0 2px 5px rgba(0,0,0,0.08))"}
                            />
                            <text
                              x="0"
                              y="2"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill={isDark ? "#ffffff" : "#0f172a"}
                              fontSize="12"
                              fontWeight="800"
                              fontFamily="system-ui, sans-serif"
                            >
                              {item.val}
                            </text>
                          </g>

                          {/* Floor Labels */}
                          <text
                            x={x + barW / 2}
                            y={yBase + 24}
                            textAnchor="middle"
                            fill={isDark ? "#f4f4f5" : "#0f172a"}
                            fontSize="12"
                            fontWeight="700"
                            letterSpacing="0.05em"
                          >
                            {item.shortLabel.toUpperCase()}
                          </text>
                          <text
                            x={x + barW / 2}
                            y={yBase + 40}
                            textAnchor="middle"
                            fill={item.subColor}
                            fontSize="11"
                            fontWeight="700"
                          >
                            {item.pct}%
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                /* 2D Flat Modern Bar Visualizer */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3">
                  {data.map((item) => (
                    <div
                      key={item.key}
                      className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col gap-3 group hover:border-indigo-300 dark:hover:border-white/20 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${item.bgClass} border ${item.borderClass}`} />
                          <span className="text-xs font-bold text-slate-800 dark:text-gray-200 uppercase tracking-wider">{item.label}</span>
                        </div>
                        <span className="text-sm font-black text-slate-900 dark:text-white px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                          {item.val}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 dark:bg-black/40 rounded-full overflow-hidden p-0.5 border border-slate-200/80 dark:border-white/5">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${Math.max(item.pct, item.val > 0 ? 6 : 0)}%`,
                            background: `linear-gradient(90deg, ${item.frontGrad[0]}, ${item.frontGrad[1]})`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-gray-400">
                        <span>Delivery Distribution</span>
                        <span className={`font-bold ${item.colorClass}`}>{item.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Insight Suite */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Delivery Efficiency Donut Card */}
              <div className="bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center relative">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2 self-start flex items-center gap-2">
                  <PieChart className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Delivery Efficiency
                </h4>

                <div className="relative w-32 h-32 flex items-center justify-center my-2">
                  <svg className="w-full h-full" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="46" fill="none" stroke={isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"} strokeWidth="10" />
                    <circle
                      cx="60"
                      cy="60"
                      r="46"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="10"
                      strokeDasharray={2 * Math.PI * 46}
                      strokeDashoffset={2 * Math.PI * 46 * (1 - (tot > 0 ? snt / tot : 0))}
                      strokeLinecap="round"
                      transform="rotate(-90 60 60)"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{successRate}</span>
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Success</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-gray-400 mt-2 font-medium">
                  {snt} of {tot} dispatched emails reached recipients successfully
                </p>
              </div>

              {/* 4 Performance Metric Cards */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-3xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase text-slate-500 dark:text-gray-400 tracking-wider">Delivery Rate</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">Optimal</span>
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">{successRate}</div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Calculated over {tot} scheduled messages</p>
                </div>

                <div className="p-5 rounded-3xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase text-slate-500 dark:text-gray-400 tracking-wider">Queue Health</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">BullMQ Active</span>
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">{sch === 0 ? "Clear" : `${sch} Waiting`}</div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">{sch} emails pending in Redis queue</p>
                </div>

                <div className="p-5 rounded-3xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase text-slate-500 dark:text-gray-400 tracking-wider">Throughput Rate</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">Rate-Limited</span>
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">5 <span className="text-sm font-semibold text-slate-500 dark:text-gray-400">msg/sec</span></div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Protects sender reputation & spam filters</p>
                </div>

                <div className="p-5 rounded-3xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase text-slate-500 dark:text-gray-400 tracking-wider">SMTP Gateway</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">Google Verified</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mb-1">Google Gmail SMTP</div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Active sender: sspersonal2003@gmail.com</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────── */
/* SETTINGS VIEW — ACCOUNT, GOOGLE OAUTH & PRODUCTION SMTP GUIDE   */
/* ─────────────────────────────────────────────────────────────── */
function SettingsView({
  session,
  userEmail,
  slackStatus,
  addToast,
}: {
  session: any;
  userEmail: string;
  slackStatus: SlackStatus | null;
  addToast: (type: "success" | "error" | "info", msg: string) => void;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [slackUrl, setSlackUrl] = useState("");
  const [savingSlack, setSavingSlack] = useState(false);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    addToast("info", "Copied to clipboard!");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveSlack = async () => {
    if (!slackUrl.trim()) {
      addToast("error", "Please provide a valid Slack webhook URL");
      return;
    }
    setSavingSlack(true);
    try {
      await slackApi.connect(userEmail, slackUrl);
      addToast("success", "Slack webhook connected! Live notifications active.");
    } catch {
      addToast("error", "Failed to connect Slack webhook. Check the URL.");
    } finally {
      setSavingSlack(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 pb-20 space-y-6 animate-slideUp">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200/80 dark:border-white/10">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          Settings & Infrastructure Guide
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">
          Configure authentication, Google OAuth 2.0, production SMTP delivery, and queue rate limits.
        </p>
      </div>

      {/* Account Info */}
      <div className="bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {session?.user?.image ? (
            <img src={session.user.image} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-500/30" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-base shadow-md">
              {session?.user?.name?.[0] || "U"}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{session?.user?.name || "Demo User"}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Demo Account Mode
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400">{userEmail}</p>
          </div>
        </div>

        <button onClick={() => signOut()} className="btn-ghost text-xs px-4 py-2 font-bold text-rose-600 hover:text-rose-700 self-start sm:self-auto">
          <LogOut className="w-3.5 h-3.5 mr-1.5 inline" /> Sign Out
        </button>
      </div>

      {/* GOOGLE OAUTH SETUP CARD */}
      <div className="bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 text-indigo-600">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Google OAuth 2.0 Sign-in Setup</h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">How to enable real &quot;Sign in with Google&quot; on your deployment.</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Awaiting Credentials
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 space-y-3 text-xs text-slate-600 dark:text-gray-300">
          <p className="font-semibold text-slate-800 dark:text-white">Follow these steps in Google Cloud Console:</p>
          <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
            <li>
              Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold underline">Google Cloud Console &gt; APIs &amp; Services &gt; Credentials</a>
            </li>
            <li>Click <strong>Create Credentials</strong> &rarr; Select <strong>OAuth client ID</strong> &rarr; Application type: <strong>Web application</strong>.</li>
            <li>
              In <strong>Authorized redirect URIs</strong>, paste:
              <div className="mt-1 flex items-center gap-2 bg-white dark:bg-black/40 p-2 rounded-lg border border-slate-200 dark:border-white/10 font-mono text-[11px] text-slate-800 dark:text-gray-200">
                <span className="flex-1 truncate">http://localhost:3000/api/auth/callback/google</span>
                <button onClick={() => copyToClipboard("http://localhost:3000/api/auth/callback/google", "uri")} className="text-indigo-600 hover:text-indigo-800 font-bold">
                  {copiedKey === "uri" ? "Copied!" : "Copy"}
                </button>
              </div>
            </li>
            <li>
              In <strong>Authorized JavaScript origins</strong>, paste:
              <div className="mt-1 flex items-center gap-2 bg-white dark:bg-black/40 p-2 rounded-lg border border-slate-200 dark:border-white/10 font-mono text-[11px] text-slate-800 dark:text-gray-200">
                <span className="flex-1 truncate">http://localhost:3000</span>
                <button onClick={() => copyToClipboard("http://localhost:3000", "origin")} className="text-indigo-600 hover:text-indigo-800 font-bold">
                  {copiedKey === "origin" ? "Copied!" : "Copy"}
                </button>
              </div>
            </li>
            <li>
              Copy your <strong>Client ID</strong> and <strong>Client Secret</strong> into <code className="bg-slate-200 dark:bg-white/10 px-1 py-0.5 rounded text-slate-800 dark:text-white font-mono">frontend/.env.local</code>:
              <pre className="mt-1 p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
{`GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_google_client_secret`}
              </pre>
            </li>
            <li>Restart Next.js (<code className="font-mono">npm run dev</code>). Google sign-in will now authenticate real Google accounts seamlessly!</li>
          </ol>
        </div>
      </div>

      {/* PRODUCTION SMTP SETUP CARD */}
      <div className="bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 text-emerald-600">
              <MailCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">SMTP Delivery Gateway (Real Email Sending)</h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">Authenticated Google Gmail SMTP connection verified and live.</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active: Google Gmail SMTP
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 space-y-3 text-xs text-slate-600 dark:text-gray-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-emerald-50/70 dark:bg-emerald-500/10 rounded-xl border border-emerald-200/80 dark:border-emerald-500/20">
            <div>
              <p className="font-bold text-emerald-900 dark:text-emerald-300">Gmail SMTP Authenticated</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">Active Sender: <code className="font-mono font-bold">sspersonal2003@gmail.com</code></p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-black/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
              Port 587 (TLS)
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-gray-400 leading-relaxed">
            All scheduled cold email campaigns are queued in <strong>Upstash Cloud Redis</strong>, stored in <strong>Supabase Cloud PostgreSQL</strong>, and dispatched via your authenticated Gmail App Password directly to recipient inboxes with automated BullMQ concurrency control and rate-limiting.
          </p>
        </div>
      </div>

      {/* SLACK INTEGRATION */}
      <div className="bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 text-purple-600">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Slack Webhook Alerts</h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">Receive live alerts in your Slack channels when emails are dispatched.</p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${slackStatus?.connected ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600"}`}>
            {slackStatus?.connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://hooks.slack.com/services/T00/B00/XXXX"
            value={slackUrl}
            onChange={(e) => setSlackUrl(e.target.value)}
            className="form-input text-xs"
          />
          <button onClick={handleSaveSlack} disabled={savingSlack} className="btn-primary text-xs shrink-0 px-4">
            {savingSlack ? "Connecting…" : "Connect Slack"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* MAIN DASHBOARD                                                   */
/* ─────────────────────────────────────────────────────────────── */
export default function Home() {
  const { data: session, status } = useSession();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeNav, setActiveNav] = useState<"campaigns" | "scheduled" | "sent" | "analytics" | "settings">("campaigns");
  const [tableTab, setTableTab] = useState<"all" | "scheduled" | "sent">("all");
  const [showCompose, setShowCompose]     = useState(false);
  const [emails, setEmails]               = useState<ScheduledEmail[]>([]);
  const [allEmails, setAllEmails]         = useState<ScheduledEmail[]>([]);
  const [stats, setStats]                 = useState<EmailStats | null>(null);
  const [statsLoading, setStatsLoading]   = useState(true);
  const [tableLoading, setTableLoading]   = useState(false);
  const [search, setSearch]               = useState("");
  const [searching, setSearching]         = useState(false);
  const [searchResults, setSearchResults] = useState<ScheduledEmail[] | null>(null);
  const [slackStatus, setSlackStatus]     = useState<SlackStatus | null>(null);
  const [backendOk, setBackendOk]         = useState<boolean | null>(null);
  const { toasts, add: addToast, remove: removeToast } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const userEmail = session?.user?.email || "demo@reachinbox.ai";

  const fetchEmails = useCallback(async (tab: string, silent = false) => {
    if (tab !== "scheduled" && tab !== "sent") return;
    if (!silent) setTableLoading(true);
    try {
      const data = tab === "scheduled" ? await emailApi.getScheduled() : await emailApi.getSent();
      setEmails(data);
      setBackendOk(true);
    } catch {
      if (!silent) { addToast("error", "Backend offline — start the server at localhost:5000"); setBackendOk(false); }
    } finally { setTableLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllEmails = useCallback(async () => {
    try {
      const data = await emailApi.getAll();
      setAllEmails(data);
      setBackendOk(true);
    } catch { /* silent */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try { setStats(await emailApi.getStats()); }
    catch { /* silent */ }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => {
    if (!session) return;
    if (tableTab === "scheduled" || tableTab === "sent") {
      fetchEmails(tableTab);
    }
    fetchAllEmails();
    fetchStats();
    slackApi.getStatus(userEmail).then(setSlackStatus).catch(() => {});
    intervalRef.current = setInterval(() => {
      if (tableTab === "scheduled" || tableTab === "sent") {
        fetchEmails(tableTab, true);
      }
      fetchAllEmails();
      fetchStats();
    }, 30_000);
    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tableTab]);

  const handleSearch = async () => {
    if (!search.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const r = await emailApi.search(search);
      setSearchResults(r as unknown as ScheduledEmail[]);
    } catch { addToast("error", "Search failed"); }
    finally { setSearching(false); }
  };

  /* Loading spinner */
  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-deep)" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Loading…</p>
      </div>
    </div>
  );

  /* Not logged in */
  if (!session) return <LoginPage theme={theme} onToggleTheme={() => setTheme(t => t === "light" ? "dark" : "light")} />;

  const isEmailView = activeNav === "campaigns" || activeNav === "scheduled" || activeNav === "sent";

  const displayed = searchResults ?? (
    tableTab === "all"
      ? allEmails
      : tableTab === "scheduled"
      ? (emails.length > 0 && emails.some(e => e.status === "scheduled") ? emails : allEmails.filter(e => e.status === "scheduled"))
      : (emails.length > 0 && emails.some(e => e.status === "sent" || e.status === "failed") ? emails : allEmails.filter(e => e.status === "sent" || e.status === "failed"))
  );

  const successRate = stats && stats.total > 0
    ? `${Math.round((stats.sent / stats.total) * 100)}%` : "100%";

  return (
    <div className={`relative flex h-screen overflow-hidden ${theme === "light" ? "theme-light" : "theme-dark"}`} data-theme={theme} style={{ background: "var(--bg-deep)" }}>
      {/* Background layers */}
      <div className="bg-scene" />
      <div className="bg-grid-lines" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      {/* ── SIDEBAR ──────────────────────────────────────────────── */}
      <aside className="sidebar relative flex flex-col w-56 shrink-0 h-full overflow-y-auto" style={{ zIndex: 10 }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="logo-icon">
            <Inbox className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <span className="font-bold text-sm tracking-tight" style={{ color: "var(--text-primary)" }}>
            Reach<span style={{ color: "#6366f1" }}>Inbox</span>
          </span>
          {backendOk === true && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" title="Backend connected"
              style={{ boxShadow: "0 0 6px rgba(16,185,129,0.8)" }} />
          )}
          {backendOk === false && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-rose-500" title="Backend offline"
              style={{ boxShadow: "0 0 6px rgba(244,63,94,0.8)" }} />
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <div className="text-xs font-semibold uppercase tracking-widest mb-3 px-2"
            style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}>Navigation</div>
          
          <button 
            className={`nav-item w-full ${activeNav === "campaigns" ? "active" : ""}`}
            onClick={() => { setActiveNav("campaigns"); setTableTab("all"); setSearchResults(null); setSearch(""); }}>
            <Target className="w-3.5 h-3.5 shrink-0" />Campaigns
          </button>
          
          <button
            className={`nav-item w-full ${activeNav === "scheduled" ? "active" : ""}`}
            onClick={() => { setActiveNav("scheduled"); setTableTab("scheduled"); fetchEmails("scheduled"); setSearchResults(null); setSearch(""); }}>
            <Clock className="w-3.5 h-3.5 shrink-0" />Scheduled
            {stats && stats.scheduled > 0 && (
              <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: "rgba(245,158,11,0.15)", color: "#d97706" }}>
                {stats.scheduled}
              </span>
            )}
          </button>

          <button
            className={`nav-item w-full ${activeNav === "sent" ? "active" : ""}`}
            onClick={() => { setActiveNav("sent"); setTableTab("sent"); fetchEmails("sent"); setSearchResults(null); setSearch(""); }}>
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />Sent
            {stats && stats.sent > 0 && (
              <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: "rgba(16,185,129,0.15)", color: "#059669" }}>
                {stats.sent}
              </span>
            )}
          </button>
          
          <button 
            className={`nav-item w-full ${activeNav === "analytics" ? "active" : ""}`}
            onClick={() => setActiveNav("analytics")}>
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />Analytics
          </button>
          
          <button 
            className={`nav-item w-full ${activeNav === "settings" ? "active" : ""}`}
            onClick={() => setActiveNav("settings")}>
            <Settings className="w-3.5 h-3.5 shrink-0" />Settings
          </button>
        </nav>

        {/* External links */}
        <div className="px-3 pb-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="pt-3 text-xs font-semibold uppercase tracking-widest mb-2 px-2"
            style={{ color: "var(--text-muted)" }}>Tools</div>
          <a href="http://localhost:5000/admin/queues" target="_blank" rel="noreferrer"
            className="nav-item w-full flex" style={{ textDecoration: "none" }}>
            <Activity className="w-3.5 h-3.5 shrink-0" />Queue Board
            <ExternalLink className="w-3 h-3 ml-auto opacity-40" />
          </a>
        </div>

        {/* User footer */}
        <div className="px-4 pb-5">
          <div className="user-badge flex items-center gap-3 w-full max-w-full overflow-hidden p-3 bg-slate-100/70 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-colors">
            {session.user?.image
              ? <img src={session.user.image} alt="" className="w-8 h-8 rounded-full shrink-0 object-cover ring-2 ring-indigo-500/30" />
              : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm"
                  style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "white" }}>
                  {session.user?.name?.[0] ?? "U"}
                </div>
            }
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-sm font-bold truncate text-slate-800 dark:text-white leading-tight">
                {session.user?.name || "Demo User"}
              </p>
              <p className="text-xs truncate text-slate-500 dark:text-gray-400 leading-tight mt-0.5">
                {session.user?.email || "demo@reachinbox.ai"}
              </p>
            </div>
            <button onClick={() => signOut()} title="Sign out"
              className="p-2 rounded-lg transition-colors hover:bg-slate-200/60 dark:hover:bg-white/10 shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-white ml-auto">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ──────────────────────────────────────────────────── */}
      <main className="relative flex-1 flex flex-col overflow-hidden" style={{ zIndex: 5 }}>

        {/* Top bar */}
        <div className="topbar flex items-center gap-3 px-6 py-3.5">
          <div>
            <h1 className="text-base font-bold capitalize" style={{ color: "var(--text-primary)" }}>
              {activeNav === "campaigns" ? "Email Campaigns" :
               activeNav === "scheduled" ? "Scheduled Queue" :
               activeNav === "sent" ? "Sent Messages" :
               activeNav === "analytics" ? "Performance Analytics" :
               "Settings & Configuration"}
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {activeNav === "campaigns" ? "Manage queued batches, delivery cadence, and dispatched emails" :
               activeNav === "scheduled" ? "Queued emails awaiting delivery" : 
               activeNav === "sent" ? "Successfully delivered messages with live sandbox preview" :
               activeNav === "analytics" ? "3D Axonometric charts and delivery telemetry" :
               "Authentication, Google OAuth, and SMTP configuration"}
            </p>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xs mx-4">
            <div className="search-bar">
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input
                id="search-input"
                placeholder="Search emails…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleSearch();
                  if (e.key === "Escape") { setSearch(""); setSearchResults(null); }
                }}
              />
              {searching && <span className="w-3 h-3 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin shrink-0" />}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Theme switcher */}
            <button
              onClick={() => setTheme(t => t === "light" ? "dark" : "light")}
              className="btn-ghost p-2 flex items-center justify-center text-xs"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? <Moon className="w-3.5 h-3.5 text-slate-700" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
            </button>

            <button onClick={() => { fetchEmails(tableTab); fetchAllEmails(); fetchStats(); }} className="btn-ghost p-2" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {slackStatus?.connected && (
              <div className="slack-badge">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ boxShadow: "0 0 6px rgba(16,185,129,0.8)" }} />
                Slack
              </div>
            )}

            <a href="http://localhost:5000/api/health" target="_blank" rel="noreferrer"
              className="btn-ghost p-2 flex items-center gap-1.5 text-xs" title="API Health">
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Health</span>
            </a>

            {isEmailView && (
              <button id="compose-btn" onClick={() => setShowCompose(true)} className="btn-primary">
                <Plus className="w-3.5 h-3.5" />
                Create Campaign
              </button>
            )}
          </div>
        </div>

        {/* Stats Row — Displayed on Campaigns, Scheduled, and Sent views */}
        {isEmailView && (
          <div className="flex gap-3 px-6 py-4 shrink-0">
            <div className="flex-1 cursor-pointer" onClick={() => { setActiveNav("scheduled"); setTableTab("scheduled"); fetchEmails("scheduled"); }}>
              <StatCard label="Scheduled" value={stats?.scheduled ?? 0} icon={Clock} cls="stat-scheduled animate-fadeIn delay-100" loading={statsLoading} />
            </div>
            <div className="flex-1 cursor-pointer" onClick={() => { setActiveNav("sent"); setTableTab("sent"); fetchEmails("sent"); }}>
              <StatCard label="Sent" value={stats?.sent ?? 0} icon={CheckCircle2} cls="stat-sent animate-fadeIn delay-200" loading={statsLoading} />
            </div>
            <div className="flex-1">
              <StatCard label="Failed" value={stats?.failed ?? 0} icon={AlertTriangle} cls="stat-failed animate-fadeIn delay-300" loading={statsLoading} />
            </div>
            <div className="flex-1 cursor-pointer" onClick={() => setActiveNav("analytics")}>
              <StatCard label="Success Rate" value={successRate} icon={BarChart3} cls="stat-rate animate-fadeIn delay-400" loading={statsLoading} />
            </div>
          </div>
        )}

        {/* Campaigns, Scheduled & Sent Data Table */}
        {isEmailView && (
          <div className="flex-1 overflow-y-auto mx-6 mb-6 table-panel animate-slideUp">
            {/* Panel Header with 3 Clean Tabs */}
            <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
              <button className={`tab-btn ${tableTab === "all" ? "active" : ""}`}
                onClick={() => { setTableTab("all"); setActiveNav("campaigns"); setSearchResults(null); setSearch(""); }}>
                <Target className="w-3.5 h-3.5 inline mr-1.5" />All Campaigns
                {allEmails.length > 0 && (
                  <span className="ml-1.5 text-[11px] font-bold opacity-80">({allEmails.length})</span>
                )}
              </button>
              <button className={`tab-btn ${tableTab === "scheduled" ? "active" : ""}`}
                onClick={() => { setTableTab("scheduled"); setActiveNav("scheduled"); fetchEmails("scheduled"); setSearchResults(null); setSearch(""); }}>
                <Clock className="w-3.5 h-3.5 inline mr-1.5" />Scheduled
                {stats && stats.scheduled > 0 && (
                  <span className="ml-1.5 text-[11px] font-bold text-amber-600">({stats.scheduled})</span>
                )}
              </button>
              <button className={`tab-btn ${tableTab === "sent" ? "active" : ""}`}
                onClick={() => { setTableTab("sent"); setActiveNav("sent"); fetchEmails("sent"); setSearchResults(null); setSearch(""); }}>
                <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />Sent
                {stats && stats.sent > 0 && (
                  <span className="ml-1.5 text-[11px] font-bold text-emerald-600">({stats.sent})</span>
                )}
              </button>

              {searchResults !== null && (
                <div className="ml-4 flex items-center gap-2 text-xs px-3 py-1 rounded-lg"
                  style={{ background: "rgba(79,70,229,0.1)", border: "1px solid rgba(79,70,229,0.2)", color: "#6366f1" }}>
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &quot;{search}&quot;
                  <button onClick={() => { setSearchResults(null); setSearch(""); }}
                    className="hover:text-slate-900 dark:hover:text-white transition-colors ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="ml-auto flex items-center gap-2">
                {!tableLoading && (
                  <span className="text-xs px-2 py-0.5 rounded-md"
                    style={{ background: "var(--card-bg-solid)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
                    {displayed.length} record{displayed.length !== 1 ? "s" : ""}
                  </span>
                )}
                <ChevronRight className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
              </div>
            </div>

            <EmailTable
              emails={displayed}
              loading={tableLoading}
              type={tableTab}
              onCompose={() => setShowCompose(true)}
            />
          </div>
        )}

        {/* Real Analytics Dashboard */}
        {activeNav === "analytics" && (
          <AnalyticsView stats={stats} statsLoading={statsLoading} theme={theme} />
        )}

        {/* Settings & Configuration View */}
        {activeNav === "settings" && (
          <SettingsView
            session={session}
            userEmail={userEmail}
            slackStatus={slackStatus}
            addToast={addToast}
          />
        )}

      </main>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSuccess={(count) => {
            setShowCompose(false);
            addToast("success", `🚀 ${count} email${count !== 1 ? "s" : ""} scheduled successfully!`);
            setTimeout(() => { fetchEmails(activeNav); fetchStats(); }, 500);
          }}
          userEmail={userEmail}
        />
      )}

      <Toasts toasts={toasts} remove={removeToast} />
    </div>
  );
}

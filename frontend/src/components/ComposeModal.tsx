'use client';

import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { X, Upload, Users, Clock, Send, Zap, Mail } from 'lucide-react';
import { emailApi } from '@/lib/api';

interface ComposeModalProps {
  onClose: () => void;
  onSuccess: () => void;
  userEmail: string;
}

export function ComposeModal({ onClose, onSuccess, userEmail }: ComposeModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [senderId, setSenderId] = useState(userEmail);
  const [delayMs, setDelayMs] = useState(2000);
  const [maxPerHour, setMaxPerHour] = useState(200);
  const [csvData, setCsvData] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0); // 0 = form, 1 = confirm

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    Papa.parse(file, {
      complete: (results) => {
        const emails = (results.data as string[][])
          .flat()
          .filter((cell) => typeof cell === 'string' && cell.includes('@'))
          .map((e) => e.trim().toLowerCase())
          .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
        // deduplicate
        setCsvData([...new Set(emails)]);
      },
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith('.csv')) return;
    const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleFileUpload(fakeEvent);
  }, [handleFileUpload]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (csvData.length === 0) {
      setError('Please upload a CSV with at least one valid email address.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Schedule each recipient individually with increasing delays
      for (let i = 0; i < csvData.length; i++) {
        const baseTime = new Date(scheduledTime).getTime();
        const offsetMs = i * delayMs;
        const recipientTime = new Date(baseTime + offsetMs).toISOString();

        await emailApi.schedule({
          recipient: csvData[i],
          subject,
          body,
          scheduledTime: recipientTime,
          senderId,
          delayBetweenEmailsMs: delayMs,
          maxEmailsPerHour: maxPerHour,
        });
      }
      onSuccess();
    } catch (err: unknown) {
      console.error(err);
      setError('Failed to schedule emails. Please check the backend connection.');
    } finally {
      setLoading(false);
    }
  };

  // Default datetime-local min value (now + 1 minute)
  const minDateTime = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/20">
              <Mail className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Compose New Email Campaign</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[80vh]">
          <div className="p-6 space-y-5">

            {/* Sender ID */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Sender ID <span className="text-indigo-400">*</span>
              </label>
              <input
                type="text"
                required
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                placeholder="e.g. your@email.com or campaign-id"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:bg-white/8 transition-all text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">Used for rate limiting per sender</p>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Subject <span className="text-indigo-400">*</span>
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:bg-white/8 transition-all text-sm"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email Body <span className="text-indigo-400">*</span>
              </label>
              <textarea
                required
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email content here..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:bg-white/8 transition-all text-sm resize-none"
              />
            </div>

            {/* CSV Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Recipients (CSV) <span className="text-indigo-400">*</span>
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="relative border-2 border-dashed border-white/15 rounded-xl p-6 text-center hover:border-indigo-500/40 transition-colors cursor-pointer group"
                onClick={() => document.getElementById('csv-input')?.click()}
              >
                <input
                  id="csv-input"
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {csvData.length > 0 ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      <Users className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-emerald-400">{csvData.length} valid emails found</p>
                      <p className="text-xs text-slate-500">{csvFileName}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2 group-hover:text-indigo-400 transition-colors" />
                    <p className="text-sm text-slate-400">Drop a CSV file here or <span className="text-indigo-400">click to browse</span></p>
                    <p className="text-xs text-slate-600 mt-1">One email per row, or comma-separated</p>
                  </div>
                )}
              </div>
            </div>

            {/* Scheduling Settings — 3 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Start Time */}
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  <Clock className="w-4 h-4 inline mr-1 text-indigo-400" />
                  Start Time <span className="text-indigo-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  min={minDateTime}
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500/60 transition-all text-sm"
                />
              </div>

              {/* Delay */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  <Zap className="w-4 h-4 inline mr-1 text-amber-400" />
                  Delay Between Emails
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={delayMs}
                    onChange={(e) => setDelayMs(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500/60 transition-all text-sm pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">ms</span>
                </div>
              </div>

              {/* Hourly Limit */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  <Send className="w-4 h-4 inline mr-1 text-indigo-400" />
                  Hourly Limit
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    value={maxPerHour}
                    onChange={(e) => setMaxPerHour(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500/60 transition-all text-sm pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">/hr</span>
                </div>
              </div>

              {/* Summary */}
              {csvData.length > 0 && scheduledTime && (
                <div className="sm:col-span-1 flex items-end">
                  <div className="w-full p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <p className="text-xs text-indigo-300 font-medium">Estimate</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ~{Math.ceil((csvData.length * delayMs) / 60000)} min total
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || csvData.length === 0}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Scheduling {csvData.length} emails...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Schedule {csvData.length > 0 ? `${csvData.length} Emails` : 'Email'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

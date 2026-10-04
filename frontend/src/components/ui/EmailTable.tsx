'use client';

import { Clock, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import type { ScheduledEmail } from '@/types';
import { EmptyState } from './EmptyState';

interface EmailTableProps {
  emails: ScheduledEmail[];
  loading: boolean;
  type: 'scheduled' | 'sent';
  onCompose?: () => void;
}

const StatusBadge = ({ status }: { status: string }) => {
  const configs: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    scheduled: {
      icon: <Clock className="w-3 h-3" />,
      label: 'Scheduled',
      cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    sent: {
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: 'Sent',
      cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    failed: {
      icon: <AlertCircle className="w-3 h-3" />,
      label: 'Failed',
      cls: 'bg-red-500/20 text-red-300 border-red-500/30',
    },
  };
  const cfg = configs[status] || configs['scheduled'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
};

const TableSkeleton = () => (
  <div className="divide-y divide-white/5">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-40" />
        <div className="h-4 bg-white/10 rounded w-56 flex-1" />
        <div className="h-4 bg-white/10 rounded w-32" />
        <div className="h-6 bg-white/10 rounded-full w-20" />
      </div>
    ))}
  </div>
);

export function EmailTable({ emails, loading, type, onCompose }: EmailTableProps) {
  if (loading) return <TableSkeleton />;

  if (emails.length === 0) {
    return (
      <EmptyState
        title={type === 'scheduled' ? 'No scheduled emails' : 'No sent emails yet'}
        description={
          type === 'scheduled'
            ? 'Schedule your first email campaign to see it here.'
            : 'Sent emails will appear here once they are delivered.'
        }
        actionLabel={type === 'scheduled' ? 'Compose Email' : undefined}
        onAction={type === 'scheduled' ? onCompose : undefined}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">
              Recipient
            </th>
            <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">
              Subject
            </th>
            <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">
              {type === 'scheduled' ? 'Scheduled For' : 'Sent At'}
            </th>
            <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">
              Sender
            </th>
            <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {emails.map((email) => (
            <tr key={email.id} className="group hover:bg-white/5 transition-colors">
              <td className="px-6 py-4">
                <p className="text-sm text-white font-medium truncate max-w-[180px]">{email.recipient}</p>
              </td>
              <td className="px-6 py-4">
                <p className="text-sm text-slate-300 truncate max-w-[240px]">{email.subject}</p>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-1.5 text-sm text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(
                    type === 'sent' && email.sentAt ? email.sentAt : email.scheduledTime
                  ).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </td>
              <td className="px-6 py-4">
                <p className="text-sm text-slate-400 truncate max-w-[160px]">{email.senderId}</p>
              </td>
              <td className="px-6 py-4">
                <StatusBadge status={email.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

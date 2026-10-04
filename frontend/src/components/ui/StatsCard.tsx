'use client';

interface StatsCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  gradient: string;
  loading?: boolean;
}

export function StatsCard({ label, value, icon, gradient, loading }: StatsCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 group hover:border-white/20 transition-all duration-300">
      {/* Gradient glow effect */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 ${gradient}`} />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400 font-medium">{label}</p>
          {loading ? (
            <div className="mt-2 h-8 w-16 bg-white/10 rounded-lg animate-pulse" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${gradient} bg-opacity-20`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

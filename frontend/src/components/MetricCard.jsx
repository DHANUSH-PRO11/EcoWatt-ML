import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export const MetricCard = ({
  title,
  value,
  unit,
  change,
  changeLabel,
  inverse = false, // If true, higher is worse (e.g. energy consumption, bill)
  icon: Icon,
  subtitle,
  badge,
}) => {
  const isPositive = typeof change === 'number' && change > 0;
  const isNegative = typeof change === 'number' && change < 0;
  const isNeutral = typeof change === 'number' && change === 0;

  // For energy usage, a drop in consumption is good (emerald), increase is red/warning
  const getChangeColor = () => {
    if (isNeutral) return 'text-slate-400 bg-slate-800/40 border-slate-700/50';
    if (inverse) {
      return isPositive
        ? 'text-red-400 bg-red-500/10 border-red-500/20'
        : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    } else {
      return isPositive
        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
        : 'text-red-400 bg-red-500/10 border-red-500/20';
    }
  };

  return (
    <div className="bg-[#111827] border border-[#1F293D] rounded-xl p-5 card-hover relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 tracking-wide uppercase">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{value}</span>
            {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
          </div>
        </div>
        {Icon && (
          <div className="p-2.5 rounded-lg bg-[#161F30] border border-[#1F293D] text-emerald-400">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        {typeof change === 'number' ? (
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-medium border ${getChangeColor()}`}>
              {isPositive && <ArrowUpRight className="w-3.5 h-3.5" />}
              {isNegative && <ArrowDownRight className="w-3.5 h-3.5" />}
              {isNeutral && <Minus className="w-3.5 h-3.5" />}
              {Math.abs(change)}%
            </span>
            {changeLabel && <span className="text-slate-400">{changeLabel}</span>}
          </div>
        ) : (
          subtitle && <span className="text-slate-400">{subtitle}</span>
        )}

        {badge && (
          <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 font-medium">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
};

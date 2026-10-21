import React from 'react';

export const SeverityBadge = ({ severity }) => {
  const styles = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/30',
    high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };

  const style = styles[severity?.toLowerCase()] || styles.low;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wider ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current animate-pulse" />
      {severity}
    </span>
  );
};

export const StatusBadge = ({ status }) => {
  const styles = {
    new: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    acknowledged: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    resolved: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  };

  const style = styles[status?.toLowerCase()] || styles.new;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize ${style}`}>
      {status}
    </span>
  );
};

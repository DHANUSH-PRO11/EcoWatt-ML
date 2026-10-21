import React from 'react';

export const EmptyState = ({ title, message, icon: Icon, action }) => {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center rounded-xl bg-[#111827] border border-[#1F293D]">
      {Icon && (
        <div className="p-3 rounded-xl bg-[#161F30] border border-[#1F293D] text-slate-400 mb-3">
          <Icon className="w-8 h-8" />
        </div>
      )}
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-400 max-w-sm">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;

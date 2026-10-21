import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Zap,
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Receipt,
  Lightbulb,
  Settings,
  Activity,
} from 'lucide-react';

export const Navbar = ({ systemStatus }) => {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/analytics', label: 'Energy Analytics', icon: BarChart3 },
    { to: '/forecasting', label: 'Forecasting', icon: TrendingUp },
    { to: '/anomalies', label: 'Anomaly Monitoring', icon: AlertTriangle },
    { to: '/billing', label: 'Bill Estimator', icon: Receipt },
    { to: '/insights', label: 'Energy Insights', icon: Lightbulb },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const isSimulated = systemStatus?.dataset?.is_simulated ?? true;
  const bestModel = systemStatus?.active_model?.model_name || 'HistGradientBoosting';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1F293D] bg-[#0B0F17]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="w-6 h-6 text-slate-950 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">EcoWatt</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                  ML
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Intelligent Consumption Analytics</p>
            </div>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#161F30] text-emerald-400 border border-emerald-500/30 shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* System status pill */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111827] border border-[#1F293D] text-xs">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300 font-medium">{bestModel}</span>
              <span className="text-slate-600">|</span>
              <span className={`font-medium ${isSimulated ? 'text-amber-400' : 'text-blue-400'}`}>
                {isSimulated ? 'Simulated Dataset' : 'UCI Dataset'}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Nav row */}
        <div className="flex md:hidden overflow-x-auto py-2.5 space-x-1 scrollbar-none border-t border-[#1F293D]">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-[#161F30] text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </header>
  );
};

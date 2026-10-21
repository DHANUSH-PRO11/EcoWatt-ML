import React, { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Zap,
  LayoutDashboard,
  Building2,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Receipt,
  Lightbulb,
  Sliders,
  HeartPulse,
  UploadCloud,
  Bell,
  Settings,
} from 'lucide-react';
import { getUnreadNotificationsCount } from '../api/client';

export const Navbar = ({ systemStatus }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = () => {
    getUnreadNotificationsCount()
      .then((data) => setUnreadCount(data.unread_count || 0))
      .catch(() => {});
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/buildings', label: 'Buildings', icon: Building2 },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/forecasting', label: 'Forecast', icon: TrendingUp },
    { to: '/anomalies', label: 'Anomalies', icon: AlertTriangle },
    { to: '/billing', label: 'Budget & Bills', icon: Receipt },
    { to: '/simulator', label: 'Simulator', icon: Sliders },
    { to: '/model-health', label: 'Model Health', icon: HeartPulse },
    { to: '/import', label: 'Import', icon: UploadCloud },
    { to: '/insights', label: 'Insights', icon: Lightbulb },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const isSimulated = systemStatus?.dataset?.is_simulated ?? true;
  const bestModel = systemStatus?.active_model?.model_name || 'HistGradientBoosting';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1F293D] bg-[#0B0F17]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="w-5 h-5 text-slate-950 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base text-white tracking-tight">EcoWatt</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                  ML 2.0
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Nav links */}
          <nav className="hidden xl:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[#161F30] text-emerald-400 border border-emerald-500/30 shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Right Header: Notifications & Telemetry pill */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <Link
              to="/notifications"
              className="relative p-2 rounded-xl bg-[#111827] border border-[#1F293D] text-slate-300 hover:text-emerald-400 hover:border-slate-600 transition"
              title="Notifications & System Alerts"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-md">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* System status pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111827] border border-[#1F293D] text-xs">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300 font-medium capitalize">{bestModel}</span>
              <span className="text-slate-600">|</span>
              <span className={`font-medium ${isSimulated ? 'text-amber-400' : 'text-blue-400'}`}>
                {isSimulated ? 'Simulated' : 'UCI Telemetry'}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile & Tablet Nav Row */}
        <div className="flex xl:hidden overflow-x-auto py-2.5 space-x-1 scrollbar-none border-t border-[#1F293D]">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
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

export default Navbar;

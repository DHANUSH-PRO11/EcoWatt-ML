import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCheck,
  Check,
  RefreshCw,
  ExternalLink,
  DollarSign,
  Activity,
  UploadCloud,
  Clock,
  Filter,
} from 'lucide-react';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const NotificationsCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [successMsg, setSuccessMsg] = useState('');

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await getNotifications(unreadOnly, 50);
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [unreadOnly]);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications(
        notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Could not mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
      setSuccessMsg('All notifications marked as read.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Could not mark all read:', err);
    }
  };

  const filtered = notifications.filter((n) => {
    if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
    return true;
  });

  const getSeverityBadge = (severity) => {
    if (severity === 'critical') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/15 text-red-400 border border-red-500/30">
          <AlertOctagon className="w-3 h-3" /> Critical
        </span>
      );
    }
    if (severity === 'warning') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3 h-3" /> Warning
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
        <Info className="w-3 h-3" /> Info
      </span>
    );
  };

  const getCategoryIcon = (category) => {
    if (category === 'budget') return <DollarSign className="w-4 h-4 text-amber-400" />;
    if (category === 'drift' || category === 'training') return <Activity className="w-4 h-4 text-purple-400" />;
    if (category === 'data_import') return <UploadCloud className="w-4 h-4 text-blue-400" />;
    return <AlertTriangle className="w-4 h-4 text-red-400" />;
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Notification & Alert Center</h1>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Live Feed
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            System alerts for consumption spikes, budget overrun projections, model drift, and training events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadNotifications}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#111827] border border-[#1F293D] text-xs font-medium text-slate-300 hover:text-white transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
          >
            <CheckCheck className="w-4 h-4 text-emerald-400" />
            Mark All Read
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          {successMsg}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#1F293D]">
        <div className="flex items-center gap-1.5 text-xs">
          {['all', 'anomaly', 'budget', 'training', 'data_import'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg capitalize font-medium transition ${
                categoryFilter === cat
                  ? 'bg-[#161F30] text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {cat === 'data_import' ? 'Data Imports' : cat}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="rounded bg-slate-800 border-[#1F293D] text-emerald-500 focus:ring-0"
          />
          Show Unread Only
        </label>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <LoadingSpinner text="Loading notification feed..." />
        ) : filtered.length > 0 ? (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition flex items-start justify-between gap-4 ${
                !item.is_read
                  ? 'bg-[#141C2B] border-emerald-500/30 shadow-md shadow-emerald-500/5'
                  : 'bg-[#111827] border-[#1F293D]'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2 rounded-xl bg-[#0B0F17] border border-[#1F293D] mt-0.5">
                  {getCategoryIcon(item.category)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-slate-100">{item.title}</h3>
                    {getSeverityBadge(item.severity)}
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {item.created_at}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 max-w-2xl">{item.message}</p>

                  {item.link_url && (
                    <div className="pt-1">
                      <Link
                        to={item.link_url}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
                      >
                        Inspect Event Details <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {!item.is_read && (
                <button
                  onClick={() => handleMarkRead(item.id)}
                  className="shrink-0 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 text-xs transition"
                  title="Mark as read"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="p-12 text-center rounded-2xl bg-[#111827] border border-[#1F293D] text-slate-400 text-xs space-y-2">
            <Bell className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <p className="font-medium text-slate-300">No notifications in this view.</p>
            <p className="text-slate-500">System alerts will appear here when events or anomalies are detected.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsCenter;

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  Info,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';
import {
  getAnomalies,
  acknowledgeAnomaly,
  resolveAnomaly,
  triggerAnomalyScan,
} from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MetricCard } from '../components/MetricCard';
import { SeverityBadge, StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';

export const AnomalyMonitoring = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [threshold, setThreshold] = useState(0.70);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);

  // Resolution modal state
  const [resolveModalAlert, setResolveModalAlert] = useState(null);
  const [resolveNotes, setResolveNotes] = useState('Reviewed by operator: confirmed transient appliance spike');
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;
      const res = await getAnomalies(params);
      setData(res);
    } catch (err) {
      console.error('Failed to load anomalies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, severityFilter]);

  const handleScan = async () => {
    try {
      setScanning(true);
      setScanMessage(null);
      const res = await triggerAnomalyScan(threshold);
      setScanMessage(res.message);
      await fetchAlerts();
    } catch (err) {
      alert(`Scan failed: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const handleAcknowledge = async (id) => {
    try {
      await acknowledgeAnomaly(id);
      await fetchAlerts();
    } catch (err) {
      alert(`Acknowledge failed: ${err.message}`);
    }
  };

  const handleConfirmResolve = async () => {
    if (!resolveModalAlert) return;
    try {
      setSubmittingAction(true);
      await resolveAnomaly(resolveModalAlert.id, resolveNotes);
      setResolveModalAlert(null);
      await fetchAlerts();
    } catch (err) {
      alert(`Resolve failed: ${err.message}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Isolation Forest Anomaly Monitoring</h1>
          <p className="text-sm text-slate-400 mt-1">
            Detect and manage unusual electricity consumption surges, baseload drifts, and irregular load spikes.
          </p>
        </div>

        {/* Scan Trigger */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#111827] border border-[#1F293D] px-3 py-1.5 rounded-lg text-xs">
            <span className="text-slate-400">Score Cutoff:</span>
            <input
              type="range"
              min="0.60"
              max="0.88"
              step="0.02"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-20 accent-emerald-500 cursor-pointer"
            />
            <span className="font-semibold text-emerald-400">{threshold}</span>
          </div>

          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#161F30] hover:bg-[#1E293B] border border-[#1F293D] text-xs font-semibold text-slate-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning...' : 'Scan New Readings'}</span>
          </button>
        </div>
      </div>

      {scanMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{scanMessage}</span>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Recorded Anomalies"
          value={data?.total || 0}
          icon={AlertTriangle}
          subtitle="All flagged intervals"
        />
        <MetricCard
          title="New Pending Alerts"
          value={data?.new_count || 0}
          badge="Action Needed"
          subtitle="Awaiting review"
        />
        <MetricCard
          title="Acknowledged"
          value={data?.acknowledged_count || 0}
          subtitle="Investigated by operator"
        />
        <MetricCard
          title="Resolved"
          value={data?.resolved_count || 0}
          icon={CheckCircle}
          subtitle="Closed with resolution notes"
        />
      </div>

      {/* Critical Disclaimer Alert */}
      <div className="p-4 rounded-xl bg-[#111827] border border-blue-500/30 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-blue-200">Statistical Anomaly Notice</p>
          <p className="text-slate-300 leading-relaxed">
            Flagged anomalies indicate significant mathematical deviation from the 24-hour moving baseline and historical diurnal
            habits. They represent unusual consumption behavior and do not constitute conclusive evidence of physical wiring defects,
            appliance degradation, or electricity theft.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#111827] border border-[#1F293D]">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium">Status:</span>
            {['all', 'new', 'acknowledged', 'resolved'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded capitalize font-medium transition ${
                  statusFilter === s
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-[#161F30] text-slate-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Severity Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium">Severity:</span>
            {['all', 'critical', 'high', 'medium', 'low'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2 py-1 rounded capitalize font-medium transition ${
                  severityFilter === sev
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#161F30] text-slate-400 hover:text-white'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <span className="text-xs text-slate-400">
          Showing {data?.items?.length || 0} alerts
        </span>
      </div>

      {/* Anomaly Table */}
      {loading ? (
        <LoadingSpinner label="Querying anomaly alert repository..." />
      ) : data?.items?.length === 0 ? (
        <EmptyState
          title="No Anomalies Match Criteria"
          message="Adjust filter parameters or trigger an updated Isolation Forest scan across newly recorded telemetry."
          icon={CheckCircle}
        />
      ) : (
        <div className="bg-[#111827] border border-[#1F293D] rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#161F30] text-slate-300 font-semibold border-b border-[#1F293D]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4 text-right">Consumption</th>
                  <th className="py-3 px-4 text-right">Baseline</th>
                  <th className="py-3 px-4 text-right">Deviation</th>
                  <th className="py-3 px-4 text-right">Score</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Explanation</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F293D] text-slate-300">
                {data.items.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-medium text-white whitespace-nowrap">
                      {alert.timestamp}
                    </td>
                    <td className="py-3 px-4">
                      <SeverityBadge severity={alert.severity} />
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white">
                      {alert.energy_kwh} kWh
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">
                      {alert.baseline_kwh} kWh
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-amber-400">
                      {alert.deviation_pct > 0 ? `+${alert.deviation_pct}%` : `${alert.deviation_pct}%`}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      {alert.anomaly_score.toFixed(3)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={alert.status} />
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-400" title={alert.explanation}>
                      {alert.explanation || '—'}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {alert.status === 'new' && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            className="px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 font-medium transition"
                          >
                            Acknowledge
                          </button>
                        )}
                        {alert.status !== 'resolved' && (
                          <button
                            onClick={() => setResolveModalAlert(alert)}
                            className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 font-medium transition"
                          >
                            Resolve
                          </button>
                        )}
                        {alert.status === 'resolved' && (
                          <span className="text-[11px] text-slate-500 italic">Resolved</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolution Notes Modal */}
      {resolveModalAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#111827] border border-[#1F293D] rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Resolve Anomaly Alert #{resolveModalAlert.id}</h3>
              <SeverityBadge severity={resolveModalAlert.severity} />
            </div>

            <p className="text-xs text-slate-400">
              Timestamp: <span className="text-white font-medium">{resolveModalAlert.timestamp}</span> &bull; Reading:{' '}
              <span className="text-white font-medium">{resolveModalAlert.energy_kwh} kWh</span>
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Resolution Notes</label>
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                rows={3}
                className="w-full bg-[#161F30] border border-[#1F293D] rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                placeholder="Describe resolution inspection (e.g. verified EV charging, heat pump burst, etc.)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setResolveModalAlert(null)}
                className="px-3.5 py-2 rounded-lg bg-[#161F30] hover:bg-[#1E293B] text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResolve}
                disabled={submittingAction}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
              >
                {submittingAction ? 'Saving...' : 'Mark as Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

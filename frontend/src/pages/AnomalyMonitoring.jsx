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
  Building2,
  Download,
  Eye,
  Flag,
  HelpCircle,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
} from 'recharts';
import {
  getAnomalies,
  acknowledgeAnomaly,
  resolveAnomaly,
  triggerAnomalyScan,
  getBuildings,
  investigateAnomaly,
  submitAnomalyFeedback,
} from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MetricCard } from '../components/MetricCard';
import { SeverityBadge, StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';

export const AnomalyMonitoring = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buildings, setBuildings] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [threshold, setThreshold] = useState(0.70);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);

  // Investigation modal state
  const [investigatingId, setInvestigatingId] = useState(null);
  const [investigationData, setInvestigationData] = useState(null);
  const [investigationLoading, setInvestigationLoading] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [isFalsePositive, setIsFalsePositive] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState('');

  // Resolution modal state
  const [resolveModalAlert, setResolveModalAlert] = useState(null);
  const [resolveNotes, setResolveNotes] = useState('Reviewed by operator: confirmed transient appliance spike');
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    getBuildings()
      .then((blds) => setBuildings(blds))
      .catch(() => {});
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;
      if (selectedBuildingId) params.building_id = selectedBuildingId;
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
  }, [statusFilter, severityFilter, selectedBuildingId]);

  const handleScan = async () => {
    try {
      setScanning(true);
      setScanMessage(null);
      const res = await triggerAnomalyScan(threshold, selectedBuildingId || null);
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

  const handleOpenInvestigate = async (id) => {
    try {
      setInvestigatingId(id);
      setInvestigationLoading(true);
      setFeedbackSuccess('');
      const inv = await investigateAnomaly(id);
      setInvestigationData(inv);
      setIsFalsePositive(inv.alert.false_positive || false);
      setFeedbackNotes(inv.alert.investigation_notes || '');
    } catch (err) {
      alert(`Investigation failed: ${err.message}`);
      setInvestigatingId(null);
    } finally {
      setInvestigationLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!investigatingId) return;
    try {
      await submitAnomalyFeedback(investigatingId, isFalsePositive, feedbackNotes);
      setFeedbackSuccess('Feedback recorded successfully!');
      await fetchAlerts();
      setTimeout(() => setFeedbackSuccess(''), 4000);
    } catch (err) {
      alert(`Feedback submission failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Advanced Anomaly Investigation</h1>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
              Isolation Forest
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Detect statistical consumption anomalies, investigate surrounding readings, submit false-positive feedback, and manage lifecycle.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {buildings.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1F293D] text-xs">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <select
                value={selectedBuildingId}
                onChange={(e) => setSelectedBuildingId(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-[#111827] text-slate-200">
                  All Facilities
                </option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id} className="bg-[#111827] text-slate-200">
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <a
            href={`/api/reports/export-csv?export_type=anomalies${selectedBuildingId ? `&building_id=${selectedBuildingId}` : ''}`}
            download
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161F30] hover:bg-[#1E293B] border border-[#1F293D] text-xs font-medium text-slate-200 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 text-xs font-bold transition shadow-lg shadow-emerald-600/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning...' : 'Scan Telemetry'}</span>
          </button>
        </div>
      </div>

      {scanMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{scanMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard
            title="Total Anomalies"
            value={data.total}
            unit="Alerts"
            icon={AlertTriangle}
            color="red"
            subtitle="Flagged by Isolation Forest"
          />
          <MetricCard
            title="New Unresolved"
            value={data.new_count}
            unit="Alerts"
            icon={ShieldAlert}
            color={data.new_count > 0 ? 'red' : 'emerald'}
            subtitle="Requires operator triage"
          />
          <MetricCard
            title="Under Review"
            value={data.acknowledged_count}
            unit="Alerts"
            icon={Clock}
            color="amber"
            subtitle="Acknowledged state"
          />
          <MetricCard
            title="Resolved Incidents"
            value={data.resolved_count}
            unit="Alerts"
            icon={CheckCircle}
            color="emerald"
            subtitle="With operator closure notes"
          />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#111827] border border-[#1F293D]">
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-200">Status:</span>
          {['all', 'new', 'acknowledged', 'resolved', 'false_positive'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded text-xs capitalize transition ${
                statusFilter === s
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white bg-[#0B0F17]'
              }`}
            >
              {s === 'false_positive' ? 'False Positive' : s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Severity:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2 py-1 rounded bg-[#0B0F17] border border-[#1F293D] text-slate-200 text-xs"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="rounded-2xl bg-[#111827] border border-[#1F293D] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner text="Scanning anomaly events..." />
          </div>
        ) : data?.items?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0B0F17] text-slate-400 uppercase text-[10px] tracking-wider border-b border-[#1F293D]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Observed Draw</th>
                  <th className="px-4 py-3">Baseline</th>
                  <th className="px-4 py-3">Deviation</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F293D]">
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-[#161F30] transition">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                      {item.timestamp}
                    </td>
                    <td className="px-4 py-3 font-bold text-white">{item.energy_kwh} kWh</td>
                    <td className="px-4 py-3 text-slate-400">{item.baseline_kwh} kWh</td>
                    <td className="px-4 py-3 font-semibold text-red-400">+{item.deviation_pct}%</td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={item.severity} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenInvestigate(item.id)}
                          className="px-2.5 py-1 rounded bg-[#0B0F17] hover:bg-slate-800 text-blue-400 border border-blue-500/30 text-xs font-medium transition flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> Investigate
                        </button>

                        {item.status === 'new' && (
                          <button
                            onClick={() => handleAcknowledge(item.id)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                          >
                            Acknowledge
                          </button>
                        )}

                        {item.status !== 'resolved' && (
                          <button
                            onClick={() => setResolveModalAlert(item)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500 text-xs">
            No anomaly events found for this filter.
          </div>
        )}
      </div>

      {/* Investigation Modal */}
      {investigatingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-[#1F293D] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">Deep Anomaly Investigation</h3>
                  {investigationData?.alert && <SeverityBadge severity={investigationData.alert.severity} />}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Facility: <strong className="text-slate-200">{investigationData?.building_name}</strong> &bull; Event: <span className="font-mono text-emerald-400">{investigationData?.alert.timestamp}</span>
                </p>
              </div>

              <button onClick={() => setInvestigatingId(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {investigationLoading ? (
              <LoadingSpinner text="Compiling surrounding +/-24h readings..." />
            ) : investigationData ? (
              <div className="space-y-4">
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#0B0F17] border border-[#1F293D]">
                    <span className="text-slate-400 block text-[11px]">Observed Spike</span>
                    <span className="text-lg font-bold text-red-400">{investigationData.alert.energy_kwh} kWh</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0B0F17] border border-[#1F293D]">
                    <span className="text-slate-400 block text-[11px]">Rolling Baseline</span>
                    <span className="text-lg font-bold text-slate-200">{investigationData.alert.baseline_kwh} kWh</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0B0F17] border border-[#1F293D]">
                    <span className="text-slate-400 block text-[11px]">Typical Slot Mean</span>
                    <span className="text-lg font-bold text-blue-400">{investigationData.same_slot_typical_kwh} kWh</span>
                  </div>
                </div>

                {/* Surrounding 24h Trend Chart */}
                <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#1F293D] space-y-2">
                  <span className="text-xs font-semibold text-slate-300 block">Surrounding 48-Hour Continuous Profile</span>
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={investigationData.surrounding_readings} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                        <XAxis
                          dataKey="timestamp"
                          stroke="#64748B"
                          fontSize={10}
                          tickLine={false}
                          tickFormatter={(t) => t.slice(11, 16)}
                        />
                        <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#1F293D', borderRadius: '0.5rem', fontSize: '11px' }}
                        />
                        <Line type="monotone" dataKey="energy_kwh" stroke="#0EA5E9" strokeWidth={2} dot={false} name="Hourly Draw (kWh)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Feedback & Investigation Notes */}
                <div className="space-y-3 pt-2 border-t border-[#1F293D]">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFalsePositive}
                      onChange={(e) => setIsFalsePositive(e.target.checked)}
                      className="rounded bg-slate-800 border-[#1F293D] text-emerald-500 focus:ring-0"
                    />
                    <span className="font-semibold text-amber-300">Flag as Expected / False Positive</span>
                    <span className="text-slate-500">(Normal deliberate activity, e.g. scheduled maintenance)</span>
                  </label>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Investigation Notes</label>
                    <textarea
                      rows={2}
                      value={feedbackNotes}
                      onChange={(e) => setFeedbackNotes(e.target.value)}
                      placeholder="Add investigation findings or operator observations..."
                      className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {feedbackSuccess && (
                    <p className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {feedbackSuccess}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-[10px] text-slate-500 max-w-sm italic">
                      {investigationData.disclaimer}
                    </p>

                    <button
                      onClick={handleSubmitFeedback}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition"
                    >
                      Save Investigation
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModalAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-[#1F293D] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Resolve Anomaly Alert</h3>
            <p className="text-xs text-slate-400">
              Close out event at <span className="font-mono text-emerald-400">{resolveModalAlert.timestamp}</span> ({resolveModalAlert.energy_kwh} kWh).
            </p>

            <div>
              <label className="text-xs text-slate-300 block mb-1">Resolution Notes</label>
              <textarea
                rows={3}
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1F293D]">
              <button
                onClick={() => setResolveModalAlert(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResolve}
                disabled={submittingAction}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition"
              >
                {submittingAction ? 'Resolving...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnomalyMonitoring;

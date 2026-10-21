import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  TrendingUp,
  Receipt,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { getDashboardSummary, acknowledgeAnomaly, getBuildings } from '../api/client';
import { MetricCard } from '../components/MetricCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SeverityBadge, StatusBadge } from '../components/StatusBadge';
import { Building2, Download } from 'lucide-react';

export const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');

  useEffect(() => {
    getBuildings()
      .then((blds) => setBuildings(blds))
      .catch(() => {});
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const summary = await getDashboardSummary(selectedBuildingId || null);
      setData(summary);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [selectedBuildingId]);

  const handleAcknowledge = async (id) => {
    try {
      setActionLoading(id);
      await acknowledgeAnomaly(id);
      // Refresh summary
      await fetchSummary();
    } catch (err) {
      alert(`Error acknowledging anomaly: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <LoadingSpinner label="Compiling dashboard analytics..." />;

  if (error) {
    return (
      <div className="p-8 text-center bg-[#111827] border border-red-500/20 rounded-xl my-8">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-white">Dashboard Unavailable</h3>
        <p className="mt-1 text-sm text-slate-400">{error}</p>
        <button
          onClick={fetchSummary}
          className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const {
    today_consumption_kwh,
    today_vs_yesterday_pct,
    billing_period_consumption_kwh,
    predicted_next_day_kwh,
    estimated_bill,
    change_vs_previous_period_pct,
    active_anomalies_count,
    recent_anomalies,
    recent_hourly_trend,
    actual_vs_predicted_trend,
    submetering_breakdown,
    data_source,
    is_simulated,
    last_updated,
  } = data;

  const totalSubmetered =
    submetering_breakdown.kitchen +
    submetering_breakdown.laundry +
    submetering_breakdown.climate_water +
    submetering_breakdown.other;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Executive Energy Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            Last reading: {last_updated} &bull; Source: {data_source}
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
                  All Facilities (Portfolio)
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
            href={`/api/reports/summary${selectedBuildingId ? `?building_id=${selectedBuildingId}` : ''}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#111827] hover:bg-[#161F30] border border-[#1F293D] text-xs font-medium text-slate-300 hover:text-white transition"
            title="Download executive intelligence report"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Executive Report</span>
          </a>

          <Link
            to="/forecasting"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#161F30] hover:bg-[#1E293B] border border-[#1F293D] text-xs font-medium text-slate-200 transition"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Forecast</span>
          </Link>
          <Link
            to="/billing"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition shadow-lg shadow-emerald-600/20"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Budget & Bills</span>
          </Link>
        </div>
      </div>

      {/* Anomaly Alert Banner if anomalies are active */}
      {active_anomalies_count > 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-200">
                {active_anomalies_count} Unusual Consumption {active_anomalies_count === 1 ? 'Alert' : 'Alerts'} Detected
              </p>
              <p className="text-xs text-amber-300/80">
                Isolation Forest flagged statistical demand spikes exceeding normal baseline boundaries.
              </p>
            </div>
          </div>
          <Link
            to="/anomalies"
            className="flex items-center gap-1 text-xs font-medium text-amber-300 hover:text-white px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 transition"
          >
            <span>Review Alerts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Today's Consumption"
          value={today_consumption_kwh}
          unit="kWh"
          change={today_vs_yesterday_pct}
          changeLabel="vs yesterday"
          inverse={true}
          icon={Zap}
        />
        <MetricCard
          title="Current 30-Day Total"
          value={billing_period_consumption_kwh}
          unit="kWh"
          change={change_vs_previous_period_pct}
          changeLabel="vs prior 30d"
          inverse={true}
          icon={Layers}
        />
        <MetricCard
          title="Forecasted Next Day"
          value={predicted_next_day_kwh}
          unit="kWh"
          icon={TrendingUp}
          badge="ML Model"
          subtitle="Recursive 24h Prediction"
        />
        <MetricCard
          title="Estimated Monthly Bill"
          value={`${estimated_bill.currency_symbol}${estimated_bill.total_estimated_bill.toFixed(2)}`}
          unit={estimated_bill.currency}
          icon={Receipt}
          subtitle={`Avg ${estimated_bill.currency_symbol}${estimated_bill.effective_rate_per_kwh.toFixed(3)}/kWh`}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Consumption Trend Chart (48 Hours) */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#1F293D] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">48-Hour Hourly Consumption Profile</h3>
              <p className="text-xs text-slate-400">Actual energy load (kWh) recorded over the past two days</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-[#161F30] text-emerald-400 border border-[#1F293D] font-medium">
              Live Hourly Feed
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={recent_hourly_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => val.split(' ')[1] || val}
                />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} unit=" kWh" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161F30',
                    borderColor: '#1F293D',
                    borderRadius: '8px',
                    color: '#F3F4F6',
                    fontSize: '12px',
                  }}
                  formatter={(val) => [`${val} kWh`, 'Energy']}
                  labelFormatter={(lbl) => `Timestamp: ${lbl}`}
                />
                <Area
                  type="monotone"
                  dataKey="energy_kwh"
                  stroke="#10B981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#emeraldGradient)"
                  name="Energy (kWh)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sub-metering Breakdown */}
        <div className="bg-[#111827] border border-[#1F293D] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">30-Day Circuit Distribution</h3>
            <p className="text-xs text-slate-400">Sub-metered partition matching UCI household sensor domains</p>

            <div className="mt-6 space-y-4">
              {/* Kitchen */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <span className="text-slate-300">Kitchen (Dishwasher, Oven, Microwave)</span>
                  <span className="text-emerald-400">
                    {submetering_breakdown.kitchen.toFixed(1)} kWh (
                    {totalSubmetered > 0 ? ((submetering_breakdown.kitchen / totalSubmetered) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${(submetering_breakdown.kitchen / totalSubmetered) * 100}%` }}
                  />
                </div>
              </div>

              {/* Laundry */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <span className="text-slate-300">Laundry & Refrigerator (Washer, Dryer)</span>
                  <span className="text-blue-400">
                    {submetering_breakdown.laundry.toFixed(1)} kWh (
                    {totalSubmetered > 0 ? ((submetering_breakdown.laundry / totalSubmetered) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(submetering_breakdown.laundry / totalSubmetered) * 100}%` }}
                  />
                </div>
              </div>

              {/* Climate & Water */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <span className="text-slate-300">Water Heater & Air Conditioner</span>
                  <span className="text-amber-400">
                    {submetering_breakdown.climate_water.toFixed(1)} kWh (
                    {totalSubmetered > 0 ? ((submetering_breakdown.climate_water / totalSubmetered) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${(submetering_breakdown.climate_water / totalSubmetered) * 100}%` }}
                  />
                </div>
              </div>

              {/* Other circuits */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <span className="text-slate-300">Other Electronics & Lighting</span>
                  <span className="text-slate-400">
                    {submetering_breakdown.other.toFixed(1)} kWh (
                    {totalSubmetered > 0 ? ((submetering_breakdown.other / totalSubmetered) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-slate-500 rounded-full"
                    style={{ width: `${(submetering_breakdown.other / totalSubmetered) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#1F293D] flex items-center justify-between text-xs text-slate-400">
            <span>Total Measured Period:</span>
            <span className="font-semibold text-white">{totalSubmetered.toFixed(1)} kWh</span>
          </div>
        </div>
      </div>

      {/* Row 2: Actual vs Predicted comparison & Recent Anomaly Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actual vs Predicted 24h Comparison */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#1F293D] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Actual vs. ML Predicted Load (24 Hours)</h3>
              <p className="text-xs text-slate-400">Chronological validation tracking forecasting accuracy</p>
            </div>
            <Link to="/forecasting" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
              View Multi-Horizon Forecast &rarr;
            </Link>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={actual_vs_predicted_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                <XAxis dataKey="timestamp" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} unit=" kWh" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161F30',
                    borderColor: '#1F293D',
                    borderRadius: '8px',
                    color: '#F3F4F6',
                    fontSize: '12px',
                  }}
                  formatter={(val, name) => [`${val} kWh`, name]}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Line
                  type="monotone"
                  dataKey="actual_kwh"
                  stroke="#38BDF8"
                  strokeWidth={2.2}
                  dot={{ r: 2.5, fill: '#38BDF8' }}
                  name="Actual Consumption"
                />
                <Line
                  type="monotone"
                  dataKey="predicted_kwh"
                  stroke="#10B981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Model Predicted"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Anomaly Alerts Mini-List */}
        <div className="bg-[#111827] border border-[#1F293D] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-white">Recent Anomaly Alerts</h3>
                <p className="text-xs text-slate-400">Latest statistical consumption deviations</p>
              </div>
              <Link to="/anomalies" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
                All Alerts
              </Link>
            </div>

            {recent_anomalies.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400/50 mb-2" />
                No anomalies currently detected. Consumption patterns within normal historical bounds.
              </div>
            ) : (
              <div className="space-y-3">
                {recent_anomalies.map((anom) => (
                  <div
                    key={anom.id}
                    className="p-3 rounded-lg bg-[#161F30] border border-[#1F293D] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={anom.severity} />
                        <span className="font-semibold text-white">{anom.energy_kwh} kWh</span>
                        <span className="text-slate-400">({anom.deviation_pct > 0 ? `+${anom.deviation_pct}%` : `${anom.deviation_pct}%`})</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{anom.timestamp}</p>
                    </div>

                    <div>
                      {anom.status === 'new' ? (
                        <button
                          onClick={() => handleAcknowledge(anom.id)}
                          disabled={actionLoading === anom.id}
                          className="px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-[11px] font-medium transition"
                        >
                          {actionLoading === anom.id ? 'Saving...' : 'Acknowledge'}
                        </button>
                      ) : (
                        <StatusBadge status={anom.status} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#1F293D] text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Isolation Forest model fitted on continuous historical baseload.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

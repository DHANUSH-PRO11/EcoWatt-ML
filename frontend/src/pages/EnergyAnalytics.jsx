import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Download,
  Calendar,
  Filter,
  BarChart3,
  Layers,
  ArrowUpDown,
  Building2,
  TrendingDown,
  TrendingUp,
  Flame,
  Moon,
  Clock,
  Zap,
} from 'lucide-react';
import {
  getEnergyAnalytics,
  getBuildings,
  getPeriodComparisons,
  getConsumptionHeatmap,
  getBaseloadPeakAnalysis,
  getCircuitAnalytics,
} from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MetricCard } from '../components/MetricCard';

export const EnergyAnalytics = () => {
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry', 'comparisons', 'heatmap', 'circuits'
  const [buildings, setBuildings] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');

  // Primary telemetry state
  const [aggregation, setAggregation] = useState('daily');
  const [datePreset, setDatePreset] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState('period');
  const [sortAsc, setSortAsc] = useState(false);

  // Advanced features state
  const [comparisons, setComparisons] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [baseload, setBaseload] = useState(null);
  const [circuits, setCircuits] = useState(null);

  useEffect(() => {
    getBuildings()
      .then((blds) => setBuildings(blds))
      .catch(() => {});
  }, []);

  const calculateDatesForPreset = (preset) => {
    const today = new Date();
    const end = today.toISOString().split('T')[0];
    let start = '';
    if (preset === '24h') {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      start = d.toISOString().split('T')[0];
    } else if (preset === '7d') {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      start = d.toISOString().split('T')[0];
    } else if (preset === '30d') {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      start = d.toISOString().split('T')[0];
    } else if (preset === '90d') {
      const d = new Date(today);
      d.setDate(d.getDate() - 90);
      start = d.toISOString().split('T')[0];
    }
    return { start, end };
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { aggregation };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (selectedBuildingId) params.building_id = selectedBuildingId;

      const res = await getEnergyAnalytics(params);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdvancedAnalytics = async () => {
    try {
      const [compRes, heatRes, baseRes, circRes] = await Promise.all([
        getPeriodComparisons(selectedBuildingId || null),
        getConsumptionHeatmap(selectedBuildingId || null),
        getBaseloadPeakAnalysis(selectedBuildingId || null),
        getCircuitAnalytics(selectedBuildingId || null, 30),
      ]);
      setComparisons(compRes);
      setHeatmap(heatRes);
      setBaseload(baseRes);
      setCircuits(circRes);
    } catch (err) {
      console.warn('Advanced analytics fetch error:', err);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchAdvancedAnalytics();
  }, [aggregation, startDate, endDate, selectedBuildingId]);

  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset === '24h') {
      setAggregation('hourly');
    } else if (preset === '90d' || preset === 'all') {
      if (aggregation === 'hourly') setAggregation('daily');
    }
    const { start, end } = calculateDatesForPreset(preset);
    setStartDate(start);
    setEndDate(end);
  };

  const sortedSeries = [...(data?.series || [])].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (typeof valA === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc ? valA - valB : valB - valA;
  });

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Granular Energy Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">
            Historical electricity telemetry, period comparisons (DoD/WoW/MoM), 24x7 heatmap, and submetering circuits.
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
            href={`/api/reports/export-csv?export_type=energy${selectedBuildingId ? `&building_id=${selectedBuildingId}` : ''}`}
            download
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161F30] hover:bg-[#1E293B] border border-[#1F293D] text-xs font-medium text-slate-200 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-1 border-b border-[#1F293D] pb-1 text-xs">
        {[
          { id: 'telemetry', label: 'Telemetry & Circuits' },
          { id: 'comparisons', label: 'DoD / WoW / MoM Comparisons' },
          { id: 'heatmap', label: '24x7 Load Heatmap' },
          { id: 'circuits', label: 'Circuit Profiles' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 rounded-lg font-medium transition ${
              activeTab === tab.id
                ? 'bg-[#161F30] text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: TELEMETRY & SUBMETERING */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6">
          {/* Preset Horizons Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#111827] border border-[#1F293D]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white">Preset Horizons:</span>
              <div className="flex items-center gap-1">
                {['24h', '7d', '30d', '90d', 'all'].map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePresetChange(p)}
                    className={`px-2.5 py-1 rounded text-xs font-medium uppercase transition ${
                      datePreset === p
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#0B0F17] text-slate-400 hover:text-white border border-[#1F293D]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Resolution:</span>
              <div className="bg-[#0B0F17] border border-[#1F293D] rounded-lg p-0.5 flex items-center space-x-1">
                {['hourly', 'daily', 'monthly'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setAggregation(mode)}
                    className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition ${
                      aggregation === mode ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Metric Cards */}
          {data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Consumption"
                value={data.total_kwh}
                unit="kWh"
                icon={BarChart3}
                color="emerald"
                subtitle={`From ${data.start_date} to ${data.end_date}`}
              />
              <MetricCard
                title="Average Consumption"
                value={data.average_kwh}
                unit={`kWh / ${aggregation === 'hourly' ? 'hr' : aggregation === 'daily' ? 'day' : 'month'}`}
                icon={Layers}
                color="blue"
                subtitle="Interval mean"
              />
              <MetricCard
                title="Peak Period Demand"
                value={data.peak_kwh}
                unit="kWh"
                icon={Flame}
                color="red"
                subtitle="Maximum recorded load"
              />
              <MetricCard
                title="Minimum Baseload"
                value={data.min_kwh}
                unit="kWh"
                icon={Moon}
                color="purple"
                subtitle="Lowest interval draw"
              />
            </div>
          )}

          {/* Main Chart */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-[#1F293D] space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">Consumption Breakdown by Sub-Metered Circuit</h3>
            <div className="h-80 w-full">
              {loading ? (
                <LoadingSpinner text="Rendering energy timeseries..." />
              ) : data?.series?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.series} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                    <XAxis dataKey="period" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0B0F17', borderColor: '#1F293D', borderRadius: '0.75rem', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="sub_1_kwh" name="Kitchen (Sub 1)" stackId="a" fill="#10B981" />
                    <Bar dataKey="sub_2_kwh" name="Laundry (Sub 2)" stackId="a" fill="#0EA5E9" />
                    <Bar dataKey="sub_3_kwh" name="Climate / HVAC (Sub 3)" stackId="a" fill="#F59E0B" />
                    <Bar dataKey="sub_other_kwh" name="Other Household (Remainder)" stackId="a" fill="#8B5CF6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  No readings available for this filter.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ADVANCED COMPARISONS */}
      {activeTab === 'comparisons' && comparisons && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Day over Day */}
            <div className="p-5 rounded-2xl bg-[#111827] border border-[#1F293D] space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Day over Day (DoD)</span>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold text-white">{comparisons.day_over_day.current_kwh}</span>
                  <span className="text-xs text-slate-400 ml-1">kWh</span>
                </div>
                <div
                  className={`flex items-center gap-1 text-xs font-bold ${
                    comparisons.day_over_day.change_pct <= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {comparisons.day_over_day.change_pct <= 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                  {comparisons.day_over_day.change_pct}%
                </div>
              </div>
              <p className="text-xs text-slate-400 border-t border-[#1F293D] pt-2">
                Previous 24h: {comparisons.day_over_day.previous_kwh} kWh (diff: {comparisons.day_over_day.change_kwh} kWh)
              </p>
            </div>

            {/* Week over Week */}
            <div className="p-5 rounded-2xl bg-[#111827] border border-[#1F293D] space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Week over Week (WoW)</span>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold text-white">{comparisons.week_over_week.current_kwh}</span>
                  <span className="text-xs text-slate-400 ml-1">kWh</span>
                </div>
                <div
                  className={`flex items-center gap-1 text-xs font-bold ${
                    comparisons.week_over_week.change_pct <= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {comparisons.week_over_week.change_pct <= 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                  {comparisons.week_over_week.change_pct}%
                </div>
              </div>
              <p className="text-xs text-slate-400 border-t border-[#1F293D] pt-2">
                Previous 7d: {comparisons.week_over_week.previous_kwh} kWh (diff: {comparisons.week_over_week.change_kwh} kWh)
              </p>
            </div>

            {/* Month over Month */}
            <div className="p-5 rounded-2xl bg-[#111827] border border-[#1F293D] space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Month over Month (MoM)</span>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold text-white">{comparisons.month_over_month.current_kwh}</span>
                  <span className="text-xs text-slate-400 ml-1">kWh</span>
                </div>
                <div
                  className={`flex items-center gap-1 text-xs font-bold ${
                    comparisons.month_over_month.change_pct <= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {comparisons.month_over_month.change_pct <= 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                  {comparisons.month_over_month.change_pct}%
                </div>
              </div>
              <p className="text-xs text-slate-400 border-t border-[#1F293D] pt-2">
                Previous 30d: {comparisons.month_over_month.previous_kwh} kWh (diff: {comparisons.month_over_month.change_kwh} kWh)
              </p>
            </div>
          </div>

          {/* Weekday vs Weekend Comparison */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-[#1F293D] space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">Weekday vs. Weekend Demand Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-[#1F293D]">
                <span className="text-slate-400 block">Weekday Mean Hourly Load</span>
                <span className="text-lg font-bold text-slate-200 mt-1 block">
                  {comparisons.weekday_vs_weekend.weekday_avg_hourly_kwh} kWh/hr
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-[#1F293D]">
                <span className="text-slate-400 block">Weekend Mean Hourly Load</span>
                <span className="text-lg font-bold text-slate-200 mt-1 block">
                  {comparisons.weekday_vs_weekend.weekend_avg_hourly_kwh} kWh/hr
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-[#1F293D]">
                <span className="text-slate-400 block">Weekend Load Shift</span>
                <span
                  className={`text-lg font-bold mt-1 block ${
                    comparisons.weekday_vs_weekend.weekend_diff_pct > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {comparisons.weekday_vs_weekend.weekend_diff_pct > 0 ? '+' : ''}
                  {comparisons.weekday_vs_weekend.weekend_diff_pct}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 24x7 LOAD HEATMAP */}
      {activeTab === 'heatmap' && heatmap && (
        <div className="p-5 rounded-2xl bg-[#111827] border border-[#1F293D] space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">24x7 Consumption Intensity Heatmap</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Identifies regular daily peak slots (typically 18:00–21:00) vs. overnight baseload across all days of the week.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center text-[10px]">
              <thead>
                <tr>
                  <th className="p-1.5 text-left text-slate-400 text-xs w-16">Day</th>
                  {Array.from({ length: 24 }).map((_, h) => (
                    <th key={h} className="p-1 text-slate-400 font-mono">
                      {h}h
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="space-y-1">
                {heatmap.matrix.map((row) => (
                  <tr key={row.day}>
                    <td className="p-1.5 text-left font-semibold text-slate-300 text-xs">{row.day}</td>
                    {row.hourly_values.map((val, h) => {
                      // Color scale based on value
                      let bg = 'bg-slate-900 text-slate-500';
                      if (val > 2.0) bg = 'bg-red-500/80 text-white font-bold';
                      else if (val > 1.4) bg = 'bg-amber-500/80 text-slate-950 font-bold';
                      else if (val > 0.8) bg = 'bg-emerald-600/70 text-white font-medium';
                      else if (val > 0.3) bg = 'bg-emerald-950/80 text-emerald-300';

                      return (
                        <td key={h} className="p-0.5">
                          <div className={`p-1 rounded ${bg}`} title={`${row.day} at ${h}:00 - ${val} kWh`}>
                            {val}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-[#1F293D]">
            <div className="flex items-center gap-4">
              <span>
                Peak Demand Hour: <strong className="text-red-400">{heatmap.peak_hour}:00 ({heatmap.peak_hour_avg_kwh} kWh)</strong>
              </span>
              <span>
                Lowest Baseload Hour: <strong className="text-emerald-400">{heatmap.lowest_hour}:00 ({heatmap.lowest_hour_avg_kwh} kWh)</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">Intensity:</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-[10px] text-emerald-300">Baseload</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-600/70 text-[10px] text-white">Moderate</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/80 text-[10px] text-slate-950">High</span>
              <span className="px-1.5 py-0.5 rounded bg-red-500/80 text-[10px] text-white">Peak</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CIRCUITS BREAKDOWN */}
      {activeTab === 'circuits' && circuits && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {circuits.circuits.map((c) => (
              <div key={c.id} className="p-5 rounded-2xl bg-[#111827] border border-[#1F293D] space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm">{c.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{c.appliances_covered}</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                    {c.share_pct}% Share
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-[#1F293D]">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Period Total</span>
                    <span className="font-semibold text-slate-200">{c.total_kwh} kWh</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Peak Hour Draw</span>
                    <span className="font-semibold text-red-400">{c.peak_kwh} kWh</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Usual Peak Time</span>
                    <span className="font-semibold text-slate-200">{c.peak_hour}:00 hrs</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 pt-1">
                  Status: <span className="text-slate-400">{c.measurement_status}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#1F293D] text-xs text-slate-400">
            <strong>Submetering Allocation Note:</strong> {circuits.disclaimer}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnergyAnalytics;

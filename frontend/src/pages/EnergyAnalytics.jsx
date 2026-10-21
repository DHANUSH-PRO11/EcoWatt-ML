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
} from 'lucide-react';
import { getEnergyAnalytics } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MetricCard } from '../components/MetricCard';

export const EnergyAnalytics = () => {
  const [aggregation, setAggregation] = useState('daily');
  const [datePreset, setDatePreset] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState('period');
  const [sortAsc, setSortAsc] = useState(false);

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
    } else {
      // Full
      start = '';
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

      const res = await getEnergyAnalytics(params);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [aggregation, startDate, endDate]);

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

  const handleExportCSV = () => {
    if (!data?.series || data.series.length === 0) return;

    const headers = [
      'Period',
      'Total_kWh',
      'Average_kWh',
      'Peak_kWh',
      'Min_kWh',
      'Kitchen_Sub1_kWh',
      'Laundry_Sub2_kWh',
      'ClimateWater_Sub3_kWh',
      'Other_Sub_kWh',
    ];

    const rows = data.series.map((item) => [
      item.period,
      item.total_kwh,
      item.avg_kwh,
      item.peak_kwh,
      item.min_kwh,
      item.sub_1_kwh,
      item.sub_2_kwh,
      item.sub_3_kwh,
      item.sub_other_kwh,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ecowatt_analytics_${aggregation}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            Analyze historical electricity usage across hourly, daily, and monthly resolutions with sub-metered circuit breakdowns.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Aggregation Toggle */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-lg p-1 flex items-center space-x-1">
            {['hourly', 'daily', 'monthly'].map((mode) => (
              <button
                key={mode}
                onClick={() => setAggregation(mode)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition ${
                  aggregation === mode
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Export CSV button */}
          <button
            onClick={handleExportCSV}
            disabled={!data?.series?.length}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161F30] hover:bg-[#1E293B] border border-[#1F293D] text-xs font-medium text-slate-200 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Presets Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#111827] border border-[#1F293D]">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white">Preset Horizons:</span>
          <div className="flex items-center gap-1">
            {[
              { id: '24h', label: '24 Hours' },
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '90d', label: '90 Days' },
              { id: 'all', label: 'All History' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  datePreset === p.id
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Date Range:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setDatePreset('custom');
              setStartDate(e.target.value);
            }}
            className="bg-[#161F30] border border-[#1F293D] text-slate-200 px-2 py-1 rounded text-xs focus:outline-none focus:border-emerald-500"
          />
          <span className="text-slate-500">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setDatePreset('custom');
              setEndDate(e.target.value);
            }}
            className="bg-[#161F30] border border-[#1F293D] text-slate-200 px-2 py-1 rounded text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Compiling multi-period energy aggregations..." />
      ) : error ? (
        <div className="p-8 text-center bg-[#111827] border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      ) : (
        <>
          {/* Aggregated KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Aggregated Energy"
              value={data.total_kwh}
              unit="kWh"
              icon={BarChart3}
              subtitle={`${data.series.length} ${aggregation} intervals`}
            />
            <MetricCard
              title={`Average per ${aggregation.slice(0, -2)}`}
              value={data.average_kwh}
              unit="kWh"
              subtitle="Mean consumption rate"
            />
            <MetricCard
              title="Peak Spike Interval"
              value={data.peak_kwh}
              unit="kWh"
              subtitle="Maximum recorded demand"
            />
            <MetricCard
              title="Minimum Interval"
              value={data.min_kwh}
              unit="kWh"
              subtitle="Lowest baseline recorded"
            />
          </div>

          {/* Stacked Sub-metering Bar Chart */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-white">Sub-metered Consumption Stack (kWh)</h3>
                <p className="text-xs text-slate-400">
                  Stacked distribution of Kitchen (Sub 1), Laundry (Sub 2), Climate/Water (Sub 3), and Other circuits
                </p>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.series} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                  <XAxis
                    dataKey="period"
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    angle={aggregation === 'daily' ? -35 : 0}
                    textAnchor={aggregation === 'daily' ? 'end' : 'middle'}
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
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Bar dataKey="sub_1_kwh" name="Kitchen (Sub 1)" stackId="a" fill="#10B981" />
                  <Bar dataKey="sub_2_kwh" name="Laundry (Sub 2)" stackId="a" fill="#38BDF8" />
                  <Bar dataKey="sub_3_kwh" name="Climate & Water (Sub 3)" stackId="a" fill="#F59E0B" />
                  <Bar dataKey="sub_other_kwh" name="Other Circuits" stackId="a" fill="#64748B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Historical Data Table */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#1F293D] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Aggregated Intervals Ledger</h3>
                <p className="text-xs text-slate-400">Detailed historical breakdown for statistical inspection</p>
              </div>
              <span className="text-xs text-slate-400">{sortedSeries.length} Records</span>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#161F30] text-slate-300 font-semibold sticky top-0 border-b border-[#1F293D]">
                  <tr>
                    <th className="py-3 px-4 cursor-pointer" onClick={() => toggleSort('period')}>
                      <div className="flex items-center gap-1">
                        <span>Period</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th className="py-3 px-4 cursor-pointer text-right" onClick={() => toggleSort('total_kwh')}>
                      <div className="flex items-center justify-end gap-1">
                        <span>Total (kWh)</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th className="py-3 px-4 cursor-pointer text-right" onClick={() => toggleSort('avg_kwh')}>
                      <div className="flex items-center justify-end gap-1">
                        <span>Average</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th className="py-3 px-4 cursor-pointer text-right" onClick={() => toggleSort('peak_kwh')}>
                      <div className="flex items-center justify-end gap-1">
                        <span>Peak</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">Kitchen</th>
                    <th className="py-3 px-4 text-right">Laundry</th>
                    <th className="py-3 px-4 text-right">Climate</th>
                    <th className="py-3 px-4 text-right">Other</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F293D] text-slate-300">
                  {sortedSeries.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-4 font-medium text-white">{row.period}</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-400">{row.total_kwh.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right">{row.avg_kwh.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right text-amber-400 font-medium">{row.peak_kwh.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right text-emerald-300/80">{row.sub_1_kwh.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right text-blue-300/80">{row.sub_2_kwh.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right text-amber-300/80">{row.sub_3_kwh.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right text-slate-400">{row.sub_other_kwh.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

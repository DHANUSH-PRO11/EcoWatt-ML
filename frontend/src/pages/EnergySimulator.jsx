import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Zap,
  DollarSign,
  TrendingDown,
  Leaf,
  Calendar,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { runEnergySimulation, getBuildings } from '../api/client';
import { MetricCard } from '../components/MetricCard';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const EnergySimulator = () => {
  const [buildings, setBuildings] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Scenario parameters
  const [reductionPct, setReductionPct] = useState(15);
  const [shiftPeakPct, setShiftPeakPct] = useState(25);
  const [weekendReductionPct, setWeekendReductionPct] = useState(10);
  const [dailyKwhTarget, setDailyKwhTarget] = useState('');
  const [billingDays, setBillingDays] = useState(30);

  useEffect(() => {
    getBuildings()
      .then((data) => {
        setBuildings(data);
        if (data.length > 0) setSelectedBuildingId(data[0].id);
      })
      .catch((err) => console.warn('Could not load buildings:', err));
  }, []);

  const executeSimulation = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await runEnergySimulation({
        reduction_pct: parseFloat(reductionPct),
        shift_peak_to_offpeak_pct: parseFloat(shiftPeakPct),
        weekend_reduction_pct: parseFloat(weekendReductionPct),
        daily_kwh_target: dailyKwhTarget ? parseFloat(dailyKwhTarget) : null,
        billing_period_days: parseInt(billingDays),
        building_id: selectedBuildingId ? parseInt(selectedBuildingId) : null,
      });
      setResult(data);
    } catch (err) {
      setErrorMsg(err.message || 'Simulation execution failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeSimulation();
  }, [reductionPct, shiftPeakPct, weekendReductionPct, dailyKwhTarget, billingDays, selectedBuildingId]);

  const handleReset = () => {
    setReductionPct(10);
    setShiftPeakPct(0);
    setWeekendReductionPct(0);
    setDailyKwhTarget('');
    setBillingDays(30);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Interactive What-If Energy Simulator</h1>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Zero-Risk Modeling
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Simulate efficiency improvements, peak load shifting, and tariff impact without altering database records or model weights.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {buildings.length > 1 && (
            <select
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#111827] border border-[#1F293D] text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#111827] border border-[#1F293D] text-xs font-medium text-slate-300 hover:text-white hover:border-slate-600 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Control Panel on Left, Results on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenario Controls Panel */}
        <div className="p-5 rounded-2xl bg-[#111827] border border-[#1F293D] space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#1F293D]">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <h2 className="font-semibold text-slate-200 text-sm">Scenario Levers</h2>
            </div>
            <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Live Compute</span>
          </div>

          {/* Slider 1: General Reduction */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Conservation Reduction</span>
              <span className="text-emerald-400 font-bold">{reductionPct}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={reductionPct}
              onChange={(e) => setReductionPct(e.target.value)}
              className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-slate-400">Targeted efficiency from thermostat setbacks & LED retrofits.</p>
          </div>

          {/* Slider 2: Peak Shifting */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Peak Shifting (18:00 - 21:00)</span>
              <span className="text-blue-400 font-bold">{shiftPeakPct}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="5"
              value={shiftPeakPct}
              onChange={(e) => setShiftPeakPct(e.target.value)}
              className="w-full accent-blue-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-slate-400">Shifts heavy laundry & dishwasher loads to midday off-peak hours.</p>
          </div>

          {/* Slider 3: Weekend Reduction */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Weekend Surge Mitigation</span>
              <span className="text-purple-400 font-bold">{weekendReductionPct}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              step="2"
              value={weekendReductionPct}
              onChange={(e) => setWeekendReductionPct(e.target.value)}
              className="w-full accent-purple-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-slate-400">Curbs unnecessary continuous weekend appliance idling.</p>
          </div>

          {/* Inputs */}
          <div className="pt-2 border-t border-[#1F293D] space-y-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1">Optional Daily Cap (kWh/day)</label>
              <input
                type="number"
                placeholder="e.g. 15.0"
                value={dailyKwhTarget}
                onChange={(e) => setDailyKwhTarget(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Billing Simulation Period (Days)</label>
              <select
                value={billingDays}
                onChange={(e) => setBillingDays(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="30">Monthly Cycle (30 Days)</option>
                <option value="60">Bi-Monthly Cycle (60 Days)</option>
                <option value="90">Quarterly Cycle (90 Days)</option>
                <option value="365">Annual Projection (365 Days)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results & Simulation Visuals */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top Outcome KPIs */}
          {result && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-[#111827] border border-[#1F293D]">
                <span className="text-[11px] text-slate-400 block">Baseline Consumption</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-lg font-bold text-slate-200">{result.baseline_kwh.toLocaleString()}</span>
                  <span className="text-xs text-slate-400">kWh</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">Measured Reference</span>
              </div>

              <div className="p-4 rounded-xl bg-[#111827] border border-emerald-500/30 bg-emerald-950/10">
                <span className="text-[11px] text-emerald-400 font-medium block">Simulated Energy</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-lg font-bold text-emerald-400">{result.simulated_kwh.toLocaleString()}</span>
                  <span className="text-xs text-emerald-500">kWh</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold block mt-1">
                  -{result.kwh_saved} kWh ({result.pct_kwh_saved}%)
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#111827] border border-blue-500/30 bg-blue-950/10">
                <span className="text-[11px] text-blue-400 font-medium block">Monthly Cost Savings</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-lg font-bold text-blue-400">
                    {result.currency_symbol}
                    {result.monthly_savings}
                  </span>
                </div>
                <span className="text-[10px] text-blue-400 block mt-1">
                  ~{result.currency_symbol}
                  {result.annual_projected_savings} / year
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#111827] border border-emerald-500/30">
                <span className="text-[11px] text-slate-400 block">Avoided Emissions</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-lg font-bold text-emerald-300">{result.monthly_co2e_avoided_kg}</span>
                  <span className="text-xs text-slate-400">kg CO₂e</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">
                  ~{result.annual_co2e_avoided_kg} kg / year
                </span>
              </div>
            </div>
          )}

          {/* 24-Hour Profile Comparison Chart */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-[#1F293D] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">24-Hour Typical Profile: Baseline vs. Scenario</h3>
                <p className="text-xs text-slate-400">
                  Visualizes time-of-use changes, demonstrating peak load shaving during 18:00–21:00.
                </p>
              </div>
              <span className="text-xs text-slate-400">Hourly Active Power (kWh)</span>
            </div>

            <div className="h-64 w-full">
              {result?.hourly_comparison ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.hourly_comparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#64748b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#64748b" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                    <XAxis dataKey="hour_label" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0B0F17', borderColor: '#1F293D', borderRadius: '0.75rem', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area
                      type="monotone"
                      dataKey="baseline_kwh"
                      name="Historical Baseline Load"
                      stroke="#94A3B8"
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#baseGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="simulated_kwh"
                      name="Scenario Simulated Load"
                      stroke="#10B981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#simGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  Adjust levers to calculate simulation curve.
                </div>
              )}
            </div>
          </div>

          {/* Methodology & Limitations Box */}
          <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#1F293D] text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
              Calculation Methodology & Disclaimer
            </div>
            <p>
              Simulated projections model proportional load transformations across verified historical baseline hours.
              Tariff calculations strictly use your configured active tiered slabs, fixed charges, and taxes.
            </p>
            <p className="text-[11px] text-slate-500 italic">
              {result?.assumptions_and_limitations}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnergySimulator;

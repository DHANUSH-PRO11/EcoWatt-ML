import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Cpu,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Building2,
  Download,
  ShieldCheck,
  HelpCircle,
  BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  postForecast,
  getModelMetrics,
  retrainModelSafe,
  getEnergyHistory,
  getBuildings,
} from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MetricCard } from '../components/MetricCard';

export const Forecasting = () => {
  const [horizon, setHorizon] = useState(24);
  const [confidence, setConfidence] = useState(0.95);
  const [buildings, setBuildings] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [forecastData, setForecastData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [recentHistory, setRecentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [error, setError] = useState(null);
  const [retrainSuccess, setRetrainSuccess] = useState(null);

  useEffect(() => {
    getBuildings()
      .then((blds) => setBuildings(blds))
      .catch(() => {});
  }, []);

  const fetchForecastAndMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const [forecastRes, metricsRes, historyRes] = await Promise.all([
        postForecast(horizon, confidence, selectedBuildingId || null),
        getModelMetrics(),
        getEnergyHistory({ limit: 24, building_id: selectedBuildingId || null }),
      ]);

      setForecastData(forecastRes);
      setMetrics(metricsRes);
      setRecentHistory(historyRes.readings || []);
    } catch (err) {
      setError(err.message || 'Failed to generate forecast');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecastAndMetrics();
  }, [horizon, confidence, selectedBuildingId]);

  const handleRetrain = async () => {
    if (!window.confirm('Trigger safe ML retraining across all 4 architectures?')) return;
    try {
      setRetraining(true);
      setRetrainSuccess(null);
      const res = await retrainModelSafe(false);
      setRetrainSuccess(res.message || 'Retraining complete');
      await fetchForecastAndMetrics();
    } catch (err) {
      alert(`Retraining failed: ${err.message}`);
    } finally {
      setRetraining(false);
    }
  };

  // Combine history with predictions for continuous chart
  const combinedChartData = [];
  if (recentHistory.length > 0) {
    recentHistory.slice(-12).forEach((item) => {
      combinedChartData.push({
        timestamp: item.timestamp.split(' ')[1] || item.timestamp,
        actual_kwh: item.energy_kwh,
        predicted_kwh: null,
        baseline_kwh: null,
        lower_bound: null,
        upper_bound: null,
      });
    });
  }

  if (forecastData?.predictions) {
    forecastData.predictions.forEach((item) => {
      combinedChartData.push({
        timestamp: item.timestamp.split(' ')[1] || item.timestamp,
        actual_kwh: null,
        predicted_kwh: item.predicted_kwh,
        baseline_kwh: item.baseline_kwh,
        lower_bound: item.lower_bound_kwh,
        upper_bound: item.upper_bound_kwh,
      });
    });
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Explainable Multi-Step Forecasting</h1>
          <p className="text-sm text-slate-400 mt-1">
            Recursive multi-step forecasting with baseline comparisons, feature explainability, and calibrated error intervals.
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
            href="/api/reports/export-csv?export_type=forecast"
            download
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161F30] hover:bg-[#1E293B] border border-[#1F293D] text-xs font-medium text-slate-200 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Forecast CSV</span>
          </a>

          <button
            onClick={handleRetrain}
            disabled={retraining}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 text-xs font-bold transition shadow-lg shadow-emerald-600/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retraining ? 'animate-spin' : ''}`} />
            <span>{retraining ? 'Retraining...' : 'Retrain Pipeline'}</span>
          </button>
        </div>
      </div>

      {retrainSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{retrainSuccess}</span>
        </div>
      )}

      {/* Horizon & Confidence Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#111827] border border-[#1F293D]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white">Forecast Horizon:</span>
          <div className="flex items-center gap-1">
            {[
              { label: 'Next 1 Hour', value: 1 },
              { label: 'Next 24 Hours', value: 24 },
              { label: 'Next 7 Days (168h)', value: 168 },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setHorizon(opt.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  horizon === opt.value
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white bg-[#161F30]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Calibrated Interval:</span>
          <select
            value={confidence}
            onChange={(e) => setConfidence(parseFloat(e.target.value))}
            className="bg-[#161F30] border border-[#1F293D] text-slate-200 px-2.5 py-1 rounded text-xs focus:outline-none focus:border-emerald-500 font-medium"
          >
            <option value={0.95}>95% Confidence (z = 1.96)</option>
            <option value={0.90}>90% Confidence (z = 1.645)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Computing multi-step recursive forecasting trajectory..." />
      ) : error ? (
        <div className="p-8 text-center bg-[#111827] border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Predicted Energy"
              value={forecastData.total_predicted_kwh}
              unit="kWh"
              icon={TrendingUp}
              color="emerald"
              subtitle={`Upcoming ${horizon} hours`}
            />
            <MetricCard
              title="Baseline Comparison"
              value={forecastData.total_baseline_kwh}
              unit="kWh"
              icon={BarChart2}
              color="amber"
              subtitle="Historical Day/Hour Mean"
            />
            <MetricCard
              title="Peak Forecast Load"
              value={forecastData.peak_predicted_kwh}
              unit="kWh"
              icon={Layers}
              color="blue"
              subtitle="Maximum anticipated draw"
            />
            <MetricCard
              title="Active Forecaster"
              value={forecastData.model_name}
              unit=""
              icon={Cpu}
              color="purple"
              subtitle={`Version ${forecastData.model_version} • σ = ${metrics?.residual_std || 0.25} kWh`}
            />
          </div>

          {/* Main Forecast Chart with Confidence Band & Baseline Comparison */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Trajectory: Observed Telemetry, Model Forecast, and Baseline Reference
                </h3>
                <p className="text-xs text-slate-400">
                  Observed historical readings transitioning into multi-step recursive forecast with calibrated bounds.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  Observed (Prior 12h)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  Model Forecast
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2.5 h-0.5 bg-amber-400 border border-dashed" />
                  Historical Baseline
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40" />
                  {Math.round(confidence * 100)}% Confidence Band
                </span>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={combinedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                  <XAxis dataKey="timestamp" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} unit=" kWh" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0B0F17',
                      borderColor: '#1F293D',
                      borderRadius: '0.75rem',
                      color: '#F3F4F6',
                      fontSize: '12px',
                    }}
                  />
                  {/* Confidence Interval Upper and Lower Bounds */}
                  <Area
                    type="monotone"
                    dataKey="upper_bound"
                    stroke="transparent"
                    fill="#10B981"
                    fillOpacity={0.12}
                    name="Upper Bound (95%)"
                  />
                  <Area
                    type="monotone"
                    dataKey="lower_bound"
                    stroke="transparent"
                    fill="#0B0F17"
                    fillOpacity={0.9}
                    name="Lower Bound"
                  />
                  {/* Historical Line */}
                  <Line
                    type="monotone"
                    dataKey="actual_kwh"
                    stroke="#38BDF8"
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: '#38BDF8' }}
                    name="Observed Energy"
                    connectNulls={false}
                  />
                  {/* Model Prediction Line */}
                  <Line
                    type="monotone"
                    dataKey="predicted_kwh"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: '#10B981' }}
                    name="Model Forecast (kWh)"
                  />
                  {/* Historical Average Baseline */}
                  <Line
                    type="monotone"
                    dataKey="baseline_kwh"
                    stroke="#F59E0B"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    name="Baseline Forecaster"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Explainability & Feature Importance Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Forecast Explainability: Top Influential Features</h3>
                <p className="text-xs text-slate-400">
                  Statistical permutation sensitivity measuring the weight of lags, rolling windows, and cyclical time encodings.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-mono">Normalized Sum: 100%</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {forecastData.top_features?.map((feat, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-[#111827] border border-[#1F293D] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{feat.feature}</span>
                    <span className="text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                      {feat.importance_pct}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${feat.importance_pct}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{feat.interpretation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Prediction Interval Calibration Card */}
          {forecastData.interval_calibration && (
            <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#1F293D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200 block">
                    Prediction Interval Calibration Verification: Certified {forecastData.interval_calibration.empirical_coverage_pct}% Empirical Coverage
                  </span>
                  <span className="text-slate-400 block text-[11px] mt-0.5">
                    Nominal {Math.round(forecastData.interval_calibration.nominal_confidence * 100)}% bounds validated against {forecastData.interval_calibration.evaluation_sample_size} held-out validation actuals.
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 italic max-w-sm sm:text-right">
                {forecastData.explainability_disclaimer}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Forecasting;

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
import { postForecast, getModelMetrics, retrainModel, getEnergyHistory } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MetricCard } from '../components/MetricCard';

export const Forecasting = () => {
  const [horizon, setHorizon] = useState(24);
  const [confidence, setConfidence] = useState(0.95);
  const [forecastData, setForecastData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [recentHistory, setRecentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [error, setError] = useState(null);
  const [retrainSuccess, setRetrainSuccess] = useState(null);

  const fetchForecastAndMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Concurrent fetch
      const [forecastRes, metricsRes, historyRes] = await Promise.all([
        postForecast(horizon, confidence),
        getModelMetrics(),
        getEnergyHistory({ limit: 24 }),
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
  }, [horizon, confidence]);

  const handleRetrain = async () => {
    if (!window.confirm('Triggering ML model retraining will compare all 4 algorithms on chronological splits. Proceed?')) {
      return;
    }
    try {
      setRetraining(true);
      setRetrainSuccess(null);
      const res = await retrainModel(false);
      setRetrainSuccess(`Retraining completed! Best model selected: '${res.metrics?.best_model_name}'`);
      await fetchForecastAndMetrics();
    } catch (err) {
      alert(`Retraining failed: ${err.message}`);
    } finally {
      setRetraining(false);
    }
  };

  // Combine tail of recent history with predictions for continuous chart
  const combinedChartData = [];
  if (recentHistory.length > 0) {
    recentHistory.slice(-12).forEach((item) => {
      combinedChartData.push({
        timestamp: item.timestamp.split(' ')[1] || item.timestamp,
        actual_kwh: item.energy_kwh,
        predicted_kwh: null,
        lower_bound: null,
        upper_bound: null,
        is_forecast: false,
      });
    });
  }

  if (forecastData?.predictions) {
    forecastData.predictions.forEach((item) => {
      combinedChartData.push({
        timestamp: item.timestamp.split(' ')[1] || item.timestamp,
        actual_kwh: null,
        predicted_kwh: item.predicted_kwh,
        lower_bound: item.lower_bound_kwh,
        upper_bound: item.upper_bound_kwh,
        is_forecast: true,
      });
    });
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Recursive Supervised Forecasting</h1>
          <p className="text-sm text-slate-400 mt-1">
            Multi-step time-series prediction with calibrated error propagation bands & zero lookahead target leakage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRetrain}
            disabled={retraining}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition shadow-lg shadow-emerald-600/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retraining ? 'animate-spin' : ''}`} />
            <span>{retraining ? 'Evaluating Models...' : 'Retrain Pipeline'}</span>
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
              { label: 'Next 24 Hours (Next Day)', value: 24 },
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
          <span className="text-slate-400">Interval Confidence:</span>
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
              title="Total Predicted Energy"
              value={forecastData.total_predicted_kwh}
              unit="kWh"
              icon={TrendingUp}
              subtitle={`Over upcoming ${horizon} hours`}
            />
            <MetricCard
              title="Average Hourly Demand"
              value={forecastData.average_predicted_kwh}
              unit="kWh"
              subtitle="Expected hourly load"
            />
            <MetricCard
              title="Peak Forecasted Load"
              value={forecastData.peak_predicted_kwh}
              unit="kWh"
              subtitle="Highest predicted surge"
            />
            <MetricCard
              title="Active Model"
              value={forecastData.model_name}
              badge="Top Performer"
              subtitle={`Residual \u03c3 = ${metrics?.residual_std || 0.25} kWh`}
            />
          </div>

          {/* Main Forecast Chart with Prediction Intervals */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Multi-Step Forecast & Confidence Interval Band
                </h3>
                <p className="text-xs text-slate-400">
                  Recent observed history transitioning into future recursive predictions with widening error bounds
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  Observed History
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  Model Forecast
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40" />
                  {Math.round(confidence * 100)}% Confidence Band
                </span>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={combinedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                  <defs>
                    <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
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
                    formatter={(val, name) => [`${val ? val + ' kWh' : '—'}`, name]}
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
                  {/* Prediction Line */}
                  <Line
                    type="monotone"
                    dataKey="predicted_kwh"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    dot={{ r: 2, fill: '#10B981' }}
                    name="Predicted kWh"
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Model Comparison Benchmark Table */}
          {metrics && (
            <div className="bg-[#111827] border border-[#1F293D] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-[#1F293D] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-white">Algorithm Benchmark Comparison</h3>
                  <p className="text-xs text-slate-400">
                    Chronological validation & holdout test evaluation (Split: {metrics.train_rows} train, {metrics.val_rows} val, {metrics.test_rows} test)
                  </p>
                </div>
                <div className="text-xs text-slate-400">
                  Trained: <span className="text-slate-200 font-medium">{new Date(metrics.trained_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#161F30] text-slate-300 font-semibold border-b border-[#1F293D]">
                    <tr>
                      <th className="py-3 px-4">Model Candidate</th>
                      <th className="py-3 px-4">Algorithm Type</th>
                      <th className="py-3 px-4 text-right">Val MAE</th>
                      <th className="py-3 px-4 text-right">Val RMSE</th>
                      <th className="py-3 px-4 text-right">Val R²</th>
                      <th className="py-3 px-4 text-right">Test MAE</th>
                      <th className="py-3 px-4 text-right">Test RMSE</th>
                      <th className="py-3 px-4 text-right">Test R²</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F293D] text-slate-300">
                    {[
                      { key: 'baseline', name: 'Historical Baseline', type: 'Day-of-Week / Hour Average' },
                      { key: 'linear_regression', name: 'Linear Regression', type: 'Standardized Linear Model' },
                      { key: 'random_forest', name: 'Random Forest', type: 'Ensemble Decision Trees' },
                      { key: 'hist_gradient_boosting', name: 'HistGradientBoosting', type: 'Histogram Boosted Trees' },
                    ].map((m) => {
                      const valScore = metrics.validation_metrics[m.key] || {};
                      const testScore = metrics.test_metrics[m.key] || {};
                      const isSelected = metrics.best_model_name === m.key;

                      return (
                        <tr key={m.key} className={`hover:bg-slate-800/40 transition ${isSelected ? 'bg-emerald-500/5' : ''}`}>
                          <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                            <span>{m.name}</span>
                            {isSelected && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                ACTIVE
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400">{m.type}</td>
                          <td className="py-3 px-4 text-right font-medium text-emerald-400">{valScore.mae?.toFixed(4) || '—'}</td>
                          <td className="py-3 px-4 text-right">{valScore.rmse?.toFixed(4) || '—'}</td>
                          <td className="py-3 px-4 text-right font-medium">{valScore.r2?.toFixed(4) || '—'}</td>
                          <td className="py-3 px-4 text-right text-slate-300 font-medium">{testScore.mae?.toFixed(4) || '—'}</td>
                          <td className="py-3 px-4 text-right text-slate-400">{testScore.rmse?.toFixed(4) || '—'}</td>
                          <td className="py-3 px-4 text-right text-slate-300">{testScore.r2?.toFixed(4) || '—'}</td>
                          <td className="py-3 px-4 text-center">
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Best Val MAE
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Evaluated</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-[#161F30]/50 border-t border-[#1F293D] text-[11px] text-slate-400 flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Production model selection is determined strictly by minimum validation MAE on non-shuffled temporal holdouts.</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

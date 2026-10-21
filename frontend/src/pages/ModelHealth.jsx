import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Play,
  RotateCcw,
  ShieldCheck,
  History,
  Layers,
  ArrowUpRight,
  Clock,
  Cpu,
} from 'lucide-react';
import {
  getModelHealth,
  getTrainingHistory,
  retrainModelSafe,
} from '../api/client';
import { MetricCard } from '../components/MetricCard';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const ModelHealth = () => {
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const [hData, histData] = await Promise.all([
        getModelHealth(),
        getTrainingHistory(15),
      ]);
      setHealth(hData);
      setHistory(histData);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load model health telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRetrain = async () => {
    if (!window.confirm('Trigger safe model retraining? All candidate architectures will compete against validation baseline.')) {
      return;
    }
    try {
      setRetraining(true);
      setErrorMsg('');
      setSuccessMsg('');
      const res = await retrainModelSafe(false);
      if (res.promoted) {
        setSuccessMsg(res.message || 'New champion model successfully promoted!');
      } else {
        setSuccessMsg(res.message || 'Candidate did not beat quality gate. Previous model preserved.');
      }
      await loadData();
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err) {
      setErrorMsg(err.message || 'Retraining failed');
    } finally {
      setRetraining(false);
    }
  };

  if (loading && !health) {
    return <LoadingSpinner text="Evaluating ML model health and error drift..." />;
  }

  const getStatusColor = (status) => {
    if (status === 'Healthy') return 'emerald';
    if (status === 'Warning') return 'amber';
    return 'red';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Model Health & Drift Monitor</h1>
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                health?.status === 'Healthy'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : health?.status === 'Warning'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
              }`}
            >
              {health?.status || 'Active'}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time tracking of rolling prediction error (MAE/RMSE), telemetry distribution drift, and safe automated retraining.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#111827] border border-[#1F293D] text-xs font-medium text-slate-300 hover:text-white hover:border-slate-600 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={handleRetrain}
            disabled={retraining}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 text-xs font-bold transition shadow-lg shadow-emerald-600/20"
          >
            {retraining ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Retraining Candidates...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Trigger Safe Retraining
              </>
            )}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      {health && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Drift Health Status"
            value={health.status}
            unit=""
            icon={HeartPulse}
            color={getStatusColor(health.status)}
            subtitle={`Drift Score: ${health.drift_score} / 1.0`}
          />
          <MetricCard
            title="Recent Rolling MAE"
            value={health.recent_rolling_mae}
            unit="kWh"
            icon={Activity}
            color="blue"
            subtitle={`Baseline: ${health.validation_baseline_mae} kWh (${health.mae_degradation_pct >= 0 ? '+' : ''}${health.mae_degradation_pct}%)`}
          />
          <MetricCard
            title="Telemetry Distribution Shift"
            value={`${health.distribution_mean_shift_pct}%`}
            unit=""
            icon={ArrowUpRight}
            color={health.distribution_mean_shift_pct > 25 ? 'amber' : 'emerald'}
            subtitle="Mean Shift vs Benchmark"
          />
          <MetricCard
            title="Active Model Version"
            value={health.best_model_name}
            unit=""
            icon={Cpu}
            color="purple"
            subtitle={`Trained: ${health.last_trained_at?.slice(0, 10)} (${health.days_since_last_train}d ago)`}
          />
        </div>
      )}

      {/* Retraining Recommendation Banner */}
      {health && (
        <div
          className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            health.retraining_recommended
              ? 'bg-amber-950/20 border-amber-500/40'
              : 'bg-[#111827] border-[#1F293D]'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-xl mt-0.5 ${
                health.retraining_recommended ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">
                {health.retraining_recommended ? 'Retraining Recommended' : 'Forecasting Model Certified Healthy'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">{health.retraining_recommendation_reason}</p>
            </div>
          </div>

          <button
            onClick={handleRetrain}
            disabled={retraining}
            className="shrink-0 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
          >
            {retraining ? 'Retraining...' : 'Run Retraining Now'}
          </button>
        </div>
      )}

      {/* Quality Gate Protocol Details & Training History Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-slate-200">Model Training History & Quality Gate Log</h2>
          </div>
          <span className="text-xs text-slate-400">{history.length} Recorded Runs</span>
        </div>

        <div className="rounded-2xl bg-[#111827] border border-[#1F293D] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0B0F17] text-slate-400 uppercase text-[10px] tracking-wider border-b border-[#1F293D]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Initiated By</th>
                  <th className="px-4 py-3">Champion Candidate</th>
                  <th className="px-4 py-3">Val MAE</th>
                  <th className="px-4 py-3">Test MAE</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Decision / Quality Gate Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F293D]">
                {history.length > 0 ? (
                  history.map((record) => (
                    <tr key={record.id} className="hover:bg-[#161F30] transition">
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        {record.started_at || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 capitalize">{record.initiated_by}</td>
                      <td className="px-4 py-3 font-medium text-emerald-400">
                        {record.best_candidate_name || 'historical_baseline'}
                      </td>
                      <td className="px-4 py-3 font-mono">{record.val_mae ? `${record.val_mae.toFixed(4)}` : '--'}</td>
                      <td className="px-4 py-3 font-mono">{record.test_mae ? `${record.test_mae.toFixed(4)}` : '--'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            record.status === 'completed'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : record.status === 'rolled_back'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-red-500/15 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 max-w-xs truncate">
                        {record.promotion_reason || record.error_message || 'Standard tournament completed.'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 italic">
                      No training logs recorded yet. Click 'Trigger Safe Retraining' to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelHealth;

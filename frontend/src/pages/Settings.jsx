import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  Cpu,
  Receipt,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { getTariff, updateTariff, getSystemStatus } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const Settings = () => {
  const [tariff, setTariff] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [fixedCharge, setFixedCharge] = useState(15.0);
  const [taxRate, setTaxRate] = useState(7.0);
  const [surchargeRate, setSurchargeRate] = useState(3.0);
  const [slabs, setSlabs] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tRes, sRes] = await Promise.all([getTariff(), getSystemStatus()]);
      setTariff(tRes);
      setSystemStatus(sRes);

      setName(tRes.name);
      setCurrency(tRes.currency);
      setCurrencySymbol(tRes.currency_symbol);
      setFixedCharge(tRes.fixed_charge);
      setTaxRate(tRes.tax_rate_pct);
      setSurchargeRate(tRes.surcharge_pct);
      setSlabs(tRes.slabs || []);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCurrencyChange = (curr) => {
    setCurrency(curr);
    switch (curr) {
      case 'EUR':
        setCurrencySymbol('€');
        break;
      case 'GBP':
        setCurrencySymbol('£');
        break;
      case 'INR':
        setCurrencySymbol('₹');
        break;
      case 'CAD':
      case 'AUD':
      case 'USD':
      default:
        setCurrencySymbol('$');
        break;
    }
  };

  const handleSlabChange = (index, field, value) => {
    const updated = [...slabs];
    updated[index] = {
      ...updated[index],
      [field]: field === 'max_kwh' ? (value === '' ? null : parseFloat(value)) : parseFloat(value) || 0,
    };
    setSlabs(updated);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveSuccess(null);
      await updateTariff({
        name,
        currency,
        currency_symbol: currencySymbol,
        fixed_charge: fixedCharge,
        tax_rate_pct: taxRate,
        surcharge_pct: surchargeRate,
        slabs,
      });
      setSaveSuccess('Configuration updated successfully in database.');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading system settings & database metadata..." />;

  const isSimulated = systemStatus?.dataset?.is_simulated ?? true;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System & Tariff Configuration</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage electricity billing tariffs, currencies, measurement units, and inspect backend machine learning artifacts.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Grid: Tariff Form and Telemetry Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Tariff Configuration Form */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#1F293D] rounded-xl p-6">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-[#1F293D]">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-white">Active Electricity Tariff</h3>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition shadow-lg shadow-emerald-600/20"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
              </button>
            </div>

            {/* Tariff Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Tariff Plan Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#161F30] border border-[#1F293D] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Currency & Fixed Charge */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className="w-full bg-[#161F30] border border-[#1F293D] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Monthly Fixed Charge ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.25"
                  value={fixedCharge}
                  onChange={(e) => setFixedCharge(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#161F30] border border-[#1F293D] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Utility Tax (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#161F30] border border-[#1F293D] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Tier Slabs Table Editor */}
            <div className="pt-2">
              <label className="block text-xs font-medium text-slate-300 mb-2">Tiered Slabs Thresholds & Rates</label>
              <div className="border border-[#1F293D] rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#161F30] text-slate-400 font-medium">
                    <tr>
                      <th className="py-2.5 px-3">Tier</th>
                      <th className="py-2.5 px-3">Max Threshold (kWh)</th>
                      <th className="py-2.5 px-3">Rate ({currencySymbol}/kWh)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F293D] text-slate-300">
                    {slabs.map((slab, idx) => (
                      <tr key={slab.tier}>
                        <td className="py-2 px-3 font-semibold text-white">Tier {slab.tier}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={slab.max_kwh ?? ''}
                            placeholder="Unlimited (null)"
                            disabled={idx === slabs.length - 1 && slab.max_kwh === null}
                            onChange={(e) => handleSlabChange(idx, 'max_kwh', e.target.value)}
                            className="w-32 bg-[#161F30] border border-[#1F293D] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            value={slab.rate}
                            onChange={(e) => handleSlabChange(idx, 'rate', e.target.value)}
                            className="w-24 bg-[#161F30] border border-[#1F293D] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </form>
        </div>

        {/* Right Col: Dataset & Model Telemetry Cards */}
        <div className="space-y-6">
          {/* Dataset Status */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1F293D]">
              <Database className="w-5 h-5 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Telemetry Data Ingestion</h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Data Source:</span>
                <span className="font-medium text-white truncate max-w-[180px]">
                  {systemStatus?.dataset?.source_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dataset Type:</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                    isSimulated ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  {isSimulated ? 'Simulated Benchmark' : 'UCI Official Telemetry'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Ingested Rows:</span>
                <span className="font-semibold text-white">{systemStatus?.dataset?.total_rows} hourly records</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Temporal Coverage:</span>
                <span className="text-slate-300">
                  {systemStatus?.dataset?.start_date ? systemStatus.dataset.start_date.split('T')[0] : '—'} to{' '}
                  {systemStatus?.dataset?.end_date ? systemStatus.dataset.end_date.split('T')[0] : '—'}
                </span>
              </div>
            </div>

            {isSimulated && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-200 leading-relaxed">
                <p className="font-medium mb-1">To connect real UCI telemetry:</p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-300">
                  <li>Download UCI Household Power dataset archive.</li>
                  <li>Extract `household_power_consumption.txt` to `data/raw/`.</li>
                  <li>Re-run database seed or ML training pipeline.</li>
                </ol>
              </div>
            )}
          </div>

          {/* Model Status */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1F293D]">
              <Cpu className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Active Machine Learning Model</h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Selected Forecaster:</span>
                <span className="font-bold text-emerald-400 capitalize">
                  {systemStatus?.active_model?.model_name || 'HistGradientBoosting'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Holdout Val MAE:</span>
                <span className="font-mono text-white">{systemStatus?.active_model?.val_mae?.toFixed(4) || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Holdout Val R²:</span>
                <span className="font-mono text-white">{systemStatus?.active_model?.val_r2?.toFixed(4) || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Test Holdout MAE:</span>
                <span className="font-mono text-white">{systemStatus?.active_model?.test_mae?.toFixed(4) || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Test Holdout R²:</span>
                <span className="font-mono text-white">{systemStatus?.active_model?.test_r2?.toFixed(4) || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  Receipt,
  Calculator,
  Sliders,
  Save,
  CheckCircle2,
  Info,
  DollarSign,
  TrendingDown,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { getTariff, updateTariff, estimateBill, getDashboardSummary } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MetricCard } from '../components/MetricCard';

export const BillEstimator = () => {
  const [tariff, setTariff] = useState(null);
  const [consumptionKwh, setConsumptionKwh] = useState(380);
  const [billingDays, setBillingDays] = useState(30);
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingTariff, setSavingTariff] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);

  // Editable slab rates in tariff state
  const [editableSlabs, setEditableSlabs] = useState([]);
  const [fixedCharge, setFixedCharge] = useState(15.0);
  const [taxRate, setTaxRate] = useState(7.0);
  const [surchargeRate, setSurchargeRate] = useState(3.0);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [tariffRes, summaryRes] = await Promise.all([getTariff(), getDashboardSummary()]);

      setTariff(tariffRes);
      setEditableSlabs(tariffRes.slabs || []);
      setFixedCharge(tariffRes.fixed_charge || 15.0);
      setTaxRate(tariffRes.tax_rate_pct || 7.0);
      setSurchargeRate(tariffRes.surcharge_pct || 3.0);

      // Pre-populate consumption from actual 30-day billing total
      if (summaryRes?.billing_period_consumption_kwh) {
        setConsumptionKwh(Math.round(summaryRes.billing_period_consumption_kwh));
      }
    } catch (err) {
      console.error('Failed to load initial tariff:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Recalculate bill whenever inputs or tariff settings change
  useEffect(() => {
    if (editableSlabs.length === 0) return;

    const runEstimate = async () => {
      try {
        const customOverride = {
          currency: tariff?.currency || 'USD',
          currency_symbol: tariff?.currency_symbol || '$',
          fixed_charge: fixedCharge,
          tax_rate_pct: taxRate,
          surcharge_pct: surchargeRate,
          slabs: editableSlabs,
        };

        const res = await estimateBill(consumptionKwh, billingDays, customOverride);
        setEstimate(res);
      } catch (err) {
        console.error('Bill estimation error:', err);
      }
    };

    runEstimate();
  }, [consumptionKwh, billingDays, editableSlabs, fixedCharge, taxRate, surchargeRate, tariff]);

  const handleSlabRateChange = (index, newRate) => {
    const updated = [...editableSlabs];
    updated[index] = { ...updated[index], rate: parseFloat(newRate) || 0.0 };
    setEditableSlabs(updated);
  };

  const handleSaveActiveTariff = async () => {
    try {
      setSavingTariff(true);
      setSaveSuccess(null);
      await updateTariff({
        fixed_charge: fixedCharge,
        tax_rate_pct: taxRate,
        surcharge_pct: surchargeRate,
        slabs: editableSlabs,
      });
      setSaveSuccess('Tariff settings saved as active production configuration!');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err) {
      alert(`Failed to save tariff: ${err.message}`);
    } finally {
      setSavingTariff(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading tariff configuration..." />;

  const currencySymbol = tariff?.currency_symbol || '$';
  const currencyCode = tariff?.currency || 'USD';

  // Chart data for slab cost breakdown
  const slabChartData = (estimate?.slab_breakdown || []).map((slab) => ({
    name: `Tier ${slab.tier}`,
    range: slab.range_label,
    kwh: slab.kwh_in_slab,
    cost: slab.slab_cost,
    rate: slab.rate_per_kwh,
  }));

  const COLORS = ['#10B981', '#38BDF8', '#F59E0B', '#EF4444'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Electricity Bill Simulator</h1>
          <p className="text-sm text-slate-400 mt-1">
            Dynamic tiered slab calculation, pro-rated meter charges, taxes, and custom tariff modeling.
          </p>
        </div>

        <button
          onClick={handleSaveActiveTariff}
          disabled={savingTariff}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition shadow-lg shadow-emerald-600/20"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{savingTariff ? 'Saving Tariff...' : 'Save as Active Tariff'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Bill Overview Metric Cards */}
      {estimate && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Estimated Bill"
            value={`${currencySymbol}${estimate.total_estimated_bill.toFixed(2)}`}
            unit={currencyCode}
            icon={Receipt}
            subtitle={`${billingDays} days billing cycle`}
          />
          <MetricCard
            title="Effective Rate"
            value={`${currencySymbol}${estimate.effective_rate_per_kwh.toFixed(3)}`}
            unit="/ kWh"
            subtitle="Blended rate across all slabs"
          />
          <MetricCard
            title="Energy Charges"
            value={`${currencySymbol}${estimate.energy_charge.toFixed(2)}`}
            subtitle="Tiered consumption cost"
          />
          <MetricCard
            title="Fixed & Taxes"
            value={`${currencySymbol}${(estimate.fixed_charge + estimate.tax_amount + estimate.surcharge_amount).toFixed(2)}`}
            subtitle={`Fixed ${currencySymbol}${estimate.fixed_charge.toFixed(2)} + Taxes`}
          />
        </div>
      )}

      {/* Interactive Controls & Live Simulation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Interactive Sliders & Consumption Input */}
        <div className="bg-[#111827] border border-[#1F293D] rounded-xl p-5 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-[#1F293D]">
            <Calculator className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">Consumption Parameters</h3>
          </div>

          {/* Consumption Slider & Number */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Total Consumption</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="5000"
                  value={consumptionKwh}
                  onChange={(e) => setConsumptionKwh(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-24 bg-[#161F30] border border-[#1F293D] text-emerald-400 font-bold px-2.5 py-1 rounded text-right text-sm focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-slate-400">kWh</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="1500"
              step="5"
              value={consumptionKwh}
              onChange={(e) => setConsumptionKwh(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>0 kWh</span>
              <span>500 kWh</span>
              <span>1000 kWh</span>
              <span>1500 kWh</span>
            </div>
          </div>

          {/* Billing Days */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Billing Period</label>
              <span className="text-xs font-bold text-white">{billingDays} Days</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[7, 15, 30, 60].map((d) => (
                <button
                  key={d}
                  onClick={() => setBillingDays(d)}
                  className={`py-1.5 rounded text-xs font-medium transition ${
                    billingDays === d
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#161F30] text-slate-400 hover:text-white border border-[#1F293D]'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Fixed Charges & Taxes Configuration */}
          <div className="pt-4 border-t border-[#1F293D] space-y-4">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Fixed Fees & Levies</h4>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Fixed Fee ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.5"
                  value={fixedCharge}
                  onChange={(e) => setFixedCharge(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#161F30] border border-[#1F293D] text-slate-200 px-2 py-1 rounded text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Utility Tax (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#161F30] border border-[#1F293D] text-slate-200 px-2 py-1 rounded text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Grid Surcharge (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={surchargeRate}
                  onChange={(e) => setSurchargeRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#161F30] border border-[#1F293D] text-slate-200 px-2 py-1 rounded text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Middle & Right Column: Tiered Slabs Table & Visual Chart */}
        <div className="lg:col-span-2 space-y-6">
          {/* Editable Slabs Ledger */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-white">Configurable Tiered Slabs</h3>
                <p className="text-xs text-slate-400">Adjust unit electricity rates per bracket in real time</p>
              </div>
              <span className="text-xs text-emerald-400 font-medium">Marginal Pricing</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#161F30] text-slate-300 font-semibold border-b border-[#1F293D]">
                  <tr>
                    <th className="py-2.5 px-3">Bracket</th>
                    <th className="py-2.5 px-3">Range</th>
                    <th className="py-2.5 px-3">Rate ({currencySymbol}/kWh)</th>
                    <th className="py-2.5 px-3 text-right">Consumed in Slab</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F293D] text-slate-300">
                  {editableSlabs.map((slab, idx) => {
                    const estItem = estimate?.slab_breakdown?.[idx];
                    return (
                      <tr key={slab.tier} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-semibold text-white">Tier {slab.tier}</td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {estItem?.range_label || `${slab.max_kwh || '> 500'} kWh`}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">{currencySymbol}</span>
                            <input
                              type="number"
                              step="0.01"
                              value={slab.rate}
                              onChange={(e) => handleSlabRateChange(idx, e.target.value)}
                              className="w-20 bg-[#161F30] border border-[#1F293D] text-white px-2 py-0.5 rounded text-xs focus:outline-none focus:border-emerald-500 font-medium"
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-emerald-400">
                          {estItem?.kwh_in_slab?.toFixed(1) || 0} kWh
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-white">
                          {currencySymbol}{estItem?.slab_cost?.toFixed(2) || '0.00'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Slab Cost Contribution Bar Chart */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-xl p-5">
            <h3 className="text-base font-semibold text-white mb-1">Cost Contribution by Tier</h3>
            <p className="text-xs text-slate-400 mb-4">Financial burden breakdown across progressive tariff brackets</p>

            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={slabChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} unit={` ${currencySymbol}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161F30',
                      borderColor: '#1F293D',
                      borderRadius: '8px',
                      color: '#F3F4F6',
                      fontSize: '12px',
                    }}
                    formatter={(val) => [`${currencySymbol}${val}`, 'Cost Contribution']}
                  />
                  <Bar dataKey="cost" name="Slab Cost" radius={[4, 4, 0, 0]}>
                    {slabChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Legal & Educational Disclaimer Notice */}
      <div className="p-4 rounded-xl bg-[#111827] border border-[#1F293D] text-xs text-slate-400 leading-relaxed flex items-center gap-3">
        <Info className="w-5 h-5 text-emerald-400 shrink-0" />
        <span>
          <strong>Disclaimer:</strong> {estimate?.disclaimer || 'This calculation is an estimate for informational purposes and does not represent an official utility billing invoice.'}
        </span>
      </div>
    </div>
  );
};

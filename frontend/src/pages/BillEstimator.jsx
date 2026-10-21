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
  Building2,
  AlertTriangle,
  Wallet,
  Clock,
  ArrowRight,
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
import {
  getTariff,
  updateTariff,
  estimateBill,
  getDashboardSummary,
  getBudgetStatus,
  getBudgetSettings,
  updateBudgetSettings,
  getBuildings,
} from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MetricCard } from '../components/MetricCard';

export const BillEstimator = () => {
  const [activeTab, setActiveTab] = useState('budget'); // 'budget' or 'tariff'
  const [buildings, setBuildings] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');

  // Tariff & Estimate state
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

  // Budget state
  const [budgetStatus, setBudgetStatus] = useState(null);
  const [budgetSettings, setBudgetSettings] = useState(null);
  const [editBudgetAmount, setEditBudgetAmount] = useState(160);
  const [editKwhTarget, setEditKwhTarget] = useState(500);
  const [editCycleDay, setEditCycleDay] = useState(1);
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetSuccess, setBudgetSuccess] = useState('');

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [tariffRes, summaryRes, bldRes, bStatusRes, bSettingsRes] = await Promise.all([
        getTariff(),
        getDashboardSummary(selectedBuildingId || null),
        getBuildings(),
        getBudgetStatus(selectedBuildingId || null),
        getBudgetSettings(selectedBuildingId || null),
      ]);

      setTariff(tariffRes);
      setBuildings(bldRes);
      setEditableSlabs(tariffRes.slabs || []);
      setFixedCharge(tariffRes.fixed_charge || 15.0);
      setTaxRate(tariffRes.tax_rate_pct || 7.0);
      setSurchargeRate(tariffRes.surcharge_pct || 3.0);

      setBudgetStatus(bStatusRes);
      setBudgetSettings(bSettingsRes);
      setEditBudgetAmount(bSettingsRes.monthly_budget_amount || 160);
      setEditKwhTarget(bSettingsRes.monthly_kwh_target || 500);
      setEditCycleDay(bSettingsRes.billing_cycle_day || 1);

      if (summaryRes?.billing_period_consumption_kwh) {
        setConsumptionKwh(Math.round(summaryRes.billing_period_consumption_kwh));
      }
    } catch (err) {
      console.error('Failed to load billing & budget data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [selectedBuildingId]);

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

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    try {
      setSavingBudget(true);
      setBudgetSuccess('');
      await updateBudgetSettings({
        building_id: selectedBuildingId ? parseInt(selectedBuildingId) : null,
        monthly_budget_amount: parseFloat(editBudgetAmount),
        monthly_kwh_target: parseFloat(editKwhTarget),
        billing_cycle_day: parseInt(editCycleDay),
      });
      setBudgetSuccess('Monthly budget and cycle settings updated!');
      const updatedStatus = await getBudgetStatus(selectedBuildingId || null);
      setBudgetStatus(updatedStatus);
      setTimeout(() => setBudgetSuccess(''), 4000);
    } catch (err) {
      alert(`Failed to save budget: ${err.message}`);
    } finally {
      setSavingBudget(false);
    }
  };

  if (loading && !tariff) return <LoadingSpinner label="Loading billing & budget infrastructure..." />;

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

  const TIER_COLORS = ['#10B981', '#34D399', '#059669', '#10B981'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Electricity Budget & Cost Forecasting</h1>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Tiered Engine
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Track monthly energy budgets, forecast end-of-period spend, and model progressive tiered tariffs with fixed meter fees.
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

          {activeTab === 'tariff' && (
            <button
              onClick={handleSaveActiveTariff}
              disabled={savingTariff}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 text-xs font-bold transition shadow-lg shadow-emerald-600/20"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingTariff ? 'Saving...' : 'Save as Active Tariff'}</span>
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-[#1F293D] pb-1 text-xs">
        <button
          onClick={() => setActiveTab('budget')}
          className={`px-3 py-2 rounded-lg font-medium transition ${
            activeTab === 'budget'
              ? 'bg-[#161F30] text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Monthly Budget & Cost Forecast
        </button>
        <button
          onClick={() => setActiveTab('tariff')}
          className={`px-3 py-2 rounded-lg font-medium transition ${
            activeTab === 'tariff'
              ? 'bg-[#161F30] text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Tiered Tariff & Slab Simulator
        </button>
      </div>

      {/* TAB 1: MONTHLY BUDGET & COST FORECASTING */}
      {activeTab === 'budget' && budgetStatus && (
        <div className="space-y-6">
          {/* Top Budget Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Monthly Budget Limit"
              value={`${budgetStatus.currency_symbol}${budgetStatus.monthly_budget_amount.toFixed(2)}`}
              unit={budgetStatus.currency}
              icon={Wallet}
              color="emerald"
              subtitle={`Target: ${budgetStatus.monthly_kwh_target} kWh`}
            />
            <MetricCard
              title="Measured Month-to-Date"
              value={`${budgetStatus.currency_symbol}${budgetStatus.measured_mtd_cost.toFixed(2)}`}
              unit={`(${budgetStatus.measured_mtd_kwh} kWh)`}
              icon={DollarSign}
              color="blue"
              subtitle={`${budgetStatus.days_elapsed_in_cycle} days elapsed in cycle`}
            />
            <MetricCard
              title="Projected Month-End Total"
              value={`${budgetStatus.currency_symbol}${budgetStatus.projected_total_cost.toFixed(2)}`}
              unit={`(${budgetStatus.projected_total_kwh} kWh)`}
              icon={Receipt}
              color={budgetStatus.is_projected_over_budget ? 'red' : 'emerald'}
              subtitle={`${budgetStatus.days_remaining_in_cycle} days remaining`}
            />
            <MetricCard
              title="Projected Budget Used"
              value={`${budgetStatus.projected_budget_used_pct}%`}
              unit=""
              icon={Percent}
              color={budgetStatus.projected_budget_used_pct > 100 ? 'red' : budgetStatus.projected_budget_used_pct > 80 ? 'amber' : 'emerald'}
              subtitle={
                budgetStatus.is_projected_over_budget
                  ? `Overspend: ${budgetStatus.currency_symbol}${budgetStatus.expected_overspend_amount}`
                  : 'Within allocated budget'
              }
            />
          </div>

          {/* Budget Consumption Progress Bar */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-[#1F293D] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Billing Cycle Spending Trajectory</h3>
                <p className="text-xs text-slate-400">
                  Measured month-to-date spending vs. projected month-end bill based on recursive ML demand forecasting.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  Measured ({budgetStatus.budget_consumed_pct}%)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  Projected ({budgetStatus.projected_budget_used_pct}%)
                </span>
              </div>
            </div>

            {/* Visual Bar */}
            <div className="space-y-1.5">
              <div className="w-full bg-[#0B0F17] h-5 rounded-lg p-0.5 border border-[#1F293D] relative overflow-hidden flex">
                <div
                  className="bg-blue-500 h-full rounded-l-md transition-all duration-500"
                  style={{ width: `${Math.min(100, budgetStatus.budget_consumed_pct)}%` }}
                  title={`Measured MTD: ${budgetStatus.currency_symbol}${budgetStatus.measured_mtd_cost}`}
                />
                <div
                  className={`h-full transition-all duration-500 ${
                    budgetStatus.is_projected_over_budget ? 'bg-red-500' : 'bg-emerald-500/60'
                  }`}
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, budgetStatus.projected_budget_used_pct) - Math.min(100, budgetStatus.budget_consumed_pct)
                    )}%`,
                  }}
                  title={`Forecasted Remaining: ${budgetStatus.currency_symbol}${(
                    budgetStatus.projected_total_cost - budgetStatus.measured_mtd_cost
                  ).toFixed(2)}`}
                />
              </div>

              <div className="flex justify-between text-[11px] text-slate-400 px-1">
                <span>Cycle Start (Day 1)</span>
                <span>80% Alert Threshold</span>
                <span>100% Budget Limit ({budgetStatus.currency_symbol}{budgetStatus.monthly_budget_amount})</span>
              </div>
            </div>

            {budgetStatus.is_projected_over_budget && (
              <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  <strong>Budget Alert:</strong> Current trajectory forecasts a {budgetStatus.currency_symbol}
                  {budgetStatus.expected_overspend_amount} overspend by cycle close. Consider shifting laundry and AC loads to off-peak hours.
                </span>
              </div>
            )}
          </div>

          {/* Budget Configuration Form */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-[#1F293D] space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">Configure Energy Budget Targets</h3>

            <form onSubmit={handleSaveBudget} className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Monthly Spending Budget ({budgetStatus.currency_symbol})</label>
                <input
                  type="number"
                  step="5"
                  value={editBudgetAmount}
                  onChange={(e) => setEditBudgetAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Monthly Target Energy (kWh)</label>
                <input
                  type="number"
                  step="10"
                  value={editKwhTarget}
                  onChange={(e) => setEditKwhTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Billing Cycle Reset (Day of Month)</label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={editCycleDay}
                  onChange={(e) => setEditCycleDay(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={savingBudget}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition"
                >
                  {savingBudget ? 'Saving...' : 'Update Budget'}
                </button>
              </div>
            </form>

            {budgetSuccess && (
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {budgetSuccess}
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TIERED TARIFF & SLAB SIMULATOR */}
      {activeTab === 'tariff' && estimate && (
        <div className="space-y-6">
          {/* Bill Overview Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Estimated Bill"
              value={`${currencySymbol}${estimate.total_estimated_bill.toFixed(2)}`}
              unit={currencyCode}
              icon={Receipt}
              color="emerald"
              subtitle={`${billingDays} days billing cycle`}
            />
            <MetricCard
              title="Effective Rate"
              value={`${currencySymbol}${estimate.effective_rate_per_kwh.toFixed(3)}`}
              unit="/ kWh"
              icon={DollarSign}
              color="blue"
              subtitle="Blended rate across all slabs"
            />
            <MetricCard
              title="Energy Slabs Cost"
              value={`${currencySymbol}${estimate.energy_charge.toFixed(2)}`}
              unit=""
              icon={Calculator}
              color="amber"
              subtitle="Sum of bracketed kWh costs"
            />
            <MetricCard
              title="Fixed & Tax Surcharges"
              value={`${currencySymbol}${(estimate.fixed_charge + estimate.tax_amount + estimate.surcharge_amount).toFixed(2)}`}
              unit=""
              icon={Percent}
              color="purple"
              subtitle={`Meter Fee (${currencySymbol}${estimate.fixed_charge.toFixed(2)}) + Taxes`}
            />
          </div>

          {/* Interactive Calculator Controls & Visual Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Interactive Inputs */}
            <div className="p-5 rounded-2xl bg-[#111827] border border-[#1F293D] space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#1F293D]">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-semibold text-slate-200 text-sm">Simulation Inputs</h3>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">{consumptionKwh} kWh</span>
              </div>

              {/* Slider for Consumption */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">Electricity Consumption</span>
                  <span className="text-emerald-400 font-bold">{consumptionKwh} kWh</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1200"
                  step="10"
                  value={consumptionKwh}
                  onChange={(e) => setConsumptionKwh(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              {/* Editable Slabs */}
              <div className="space-y-3 pt-2 border-t border-[#1F293D]">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Configured Tariff Brackets ({currencySymbol}/kWh)
                </span>

                <div className="space-y-2">
                  {editableSlabs.map((slab, idx) => (
                    <div key={slab.tier} className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#0B0F17] border border-[#1F293D]">
                      <div>
                        <span className="font-semibold text-slate-200 block">Tier {slab.tier}</span>
                        <span className="text-[10px] text-slate-400">
                          {slab.max_kwh ? `0 - ${slab.max_kwh} kWh` : 'Upper bracket (>500)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 text-xs">{currencySymbol}</span>
                        <input
                          type="number"
                          step="0.01"
                          value={slab.rate}
                          onChange={(e) => handleSlabRateChange(idx, e.target.value)}
                          className="w-20 px-2 py-1 rounded bg-[#111827] border border-[#1F293D] text-slate-100 font-mono text-right focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fixed fees & taxes */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1F293D] text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Meter Fee ({currencySymbol})</span>
                  <input
                    type="number"
                    step="1"
                    value={fixedCharge}
                    onChange={(e) => setFixedCharge(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded bg-[#0B0F17] border border-[#1F293D] text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Tax (%)</span>
                  <input
                    type="number"
                    step="0.5"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded bg-[#0B0F17] border border-[#1F293D] text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Surcharge (%)</span>
                  <input
                    type="number"
                    step="0.5"
                    value={surchargeRate}
                    onChange={(e) => setSurchargeRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded bg-[#0B0F17] border border-[#1F293D] text-slate-100 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Slab Breakdown Chart & Slabs Table */}
            <div className="lg:col-span-2 space-y-5">
              <div className="p-5 rounded-2xl bg-[#111827] border border-[#1F293D] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">Slab Allocation & Marginal Costs</h3>
                  <span className="text-xs text-slate-400">Total: {currencySymbol}{estimate.total_estimated_bill.toFixed(2)}</span>
                </div>

                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={slabChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748B" fontSize={11} tickLine={false} unit={` ${currencySymbol}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0B0F17', borderColor: '#1F293D', borderRadius: '0.75rem', fontSize: '12px' }}
                      />
                      <Bar dataKey="cost" name={`Cost (${currencySymbol})`} radius={[6, 6, 0, 0]}>
                        {slabChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={TIER_COLORS[index % TIER_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Detailed Breakdown Table */}
              <div className="rounded-2xl bg-[#111827] border border-[#1F293D] overflow-hidden">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#0B0F17] text-slate-400 uppercase text-[10px] tracking-wider border-b border-[#1F293D]">
                    <tr>
                      <th className="px-4 py-3">Tier</th>
                      <th className="px-4 py-3">Consumption Bracket</th>
                      <th className="px-4 py-3">Billed kWh</th>
                      <th className="px-4 py-3">Rate</th>
                      <th className="px-4 py-3 text-right">Bracket Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F293D]">
                    {estimate.slab_breakdown.map((s) => (
                      <tr key={s.tier} className="hover:bg-[#161F30]">
                        <td className="px-4 py-2.5 font-bold text-white">Tier {s.tier}</td>
                        <td className="px-4 py-2.5 text-slate-400">{s.range_label}</td>
                        <td className="px-4 py-2.5 font-mono">{s.kwh_in_slab.toFixed(2)} kWh</td>
                        <td className="px-4 py-2.5 font-mono text-emerald-400">
                          {currencySymbol}{s.rate_per_kwh.toFixed(3)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-white">
                          {currencySymbol}{s.slab_cost.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillEstimator;

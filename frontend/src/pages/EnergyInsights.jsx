import React, { useEffect, useState } from 'react';
import {
  Lightbulb,
  TrendingDown,
  Moon,
  Clock,
  Calendar,
  Zap,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from 'recharts';
import { getInsights } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MetricCard } from '../components/MetricCard';

export const EnergyInsights = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInsightsData = async () => {
      try {
        setLoading(true);
        const res = await getInsights();
        setData(res);
      } catch (err) {
        setError(err.message || 'Failed to generate recommendations');
      } finally {
        setLoading(false);
      }
    };

    fetchInsightsData();
  }, []);

  if (loading) return <LoadingSpinner label="Auditing measured historical consumption patterns..." />;

  if (error) {
    return (
      <div className="p-8 text-center bg-[#111827] border border-red-500/20 rounded-xl">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  const {
    total_potential_monthly_savings_kwh,
    total_potential_monthly_savings_currency,
    currency,
    currency_symbol,
    insights,
    baseload_analysis,
    peak_hours_analysis,
    weekend_vs_weekday_analysis,
    hourly_distribution,
  } = data;

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'baseload':
        return Moon;
      case 'peak_usage':
        return Clock;
      case 'weekend':
        return Calendar;
      case 'anomalous_spikes':
        return Zap;
      default:
        return Lightbulb;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Evidence-Based Efficiency Insights</h1>
        <p className="text-sm text-slate-400 mt-1">
          Algorithmic energy reduction recommendations derived strictly from recorded electrical metrics and active tariff rates.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Potential Monthly Savings"
          value={`${currency_symbol}${total_potential_monthly_savings_currency.toFixed(2)}`}
          unit={currency}
          icon={TrendingDown}
          subtitle="Documented monetary reduction"
        />
        <MetricCard
          title="Potential Energy Reduction"
          value={total_potential_monthly_savings_kwh.toFixed(1)}
          unit="kWh/mo"
          subtitle="Eliminated waste energy"
        />
        <MetricCard
          title="Measured Overnight Baseload"
          value={baseload_analysis?.avg_overnight_hourly_kwh?.toFixed(2) || '0.35'}
          unit="kWh/h"
          icon={Moon}
          subtitle={`Ratio: ${(baseload_analysis?.overnight_to_daily_ratio * 100 || 30).toFixed(0)}% of daily average`}
        />
        <MetricCard
          title="Weekend Surge Delta"
          value={`${weekend_vs_weekday_analysis?.weekend_surge_pct > 0 ? '+' : ''}${weekend_vs_weekday_analysis?.weekend_surge_pct || 0}%`}
          unit="vs weekday"
          icon={Calendar}
          subtitle={`${weekend_vs_weekday_analysis?.avg_weekend_daily_kwh || 0} vs ${weekend_vs_weekday_analysis?.avg_weekday_daily_kwh || 0} kWh/d`}
        />
      </div>

      {/* 24-Hour Diurnal Demand Curve Chart */}
      <div className="bg-[#111827] border border-[#1F293D] rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">24-Hour Diurnal Demand Profile (00:00 - 23:00)</h3>
            <p className="text-xs text-slate-400">
              Average hourly energy with shaded overnight baseload (01:00–05:00) and evening peak window (18:00–21:00)
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/20 border border-blue-500/40" />
              Overnight Baseload Window
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/40" />
              Peak Concentration Window
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourly_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="hourGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
              <XAxis dataKey="hour" stroke="#64748B" fontSize={11} tickLine={false} tickFormatter={(h) => `${h}:00`} />
              <YAxis stroke="#64748B" fontSize={11} tickLine={false} unit=" kWh" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161F30',
                  borderColor: '#1F293D',
                  borderRadius: '8px',
                  color: '#F3F4F6',
                  fontSize: '12px',
                }}
                formatter={(val) => [`${val} kWh`, 'Hourly Mean']}
                labelFormatter={(h) => `Hour ${h}:00`}
              />
              {/* Highlight Overnight Baseload (1 to 5) */}
              <ReferenceArea x1={1} x2={5} fill="#38BDF8" fillOpacity={0.08} />
              {/* Highlight Peak Window (18 to 21) */}
              <ReferenceArea x1={18} x2={21} fill="#F59E0B" fillOpacity={0.08} />

              <Area
                type="monotone"
                dataKey="avg_kwh"
                stroke="#10B981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#hourGradient)"
                name="Average Hourly Demand"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Actionable Recommendations Cards List */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-white">Actionable Opportunities</h3>

        {insights.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-[#111827] border border-[#1F293D] text-slate-400 text-sm">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            Excellent consumption profile. No excessive baseload or unshifted peak surges detected.
          </div>
        ) : (
          insights.map((item) => {
            const Icon = getCategoryIcon(item.category);
            return (
              <div
                key={item.id}
                className="bg-[#111827] border border-[#1F293D] rounded-xl p-5 card-hover relative overflow-hidden"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-lg bg-[#161F30] border border-[#1F293D] text-emerald-400 shrink-0 mt-0.5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-bold text-white">{item.title}</h4>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 font-medium capitalize">
                          {item.category.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Measured Pattern That Triggered This */}
                      <div className="p-3 rounded-lg bg-[#161F30] border border-[#1F293D] text-xs space-y-1">
                        <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                          Measured Pattern Trigger:
                        </span>
                        <p className="text-slate-300 leading-relaxed">{item.triggering_pattern}</p>
                      </div>

                      {/* Actionable Recommendation */}
                      <div className="text-xs space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Recommended Action:
                        </span>
                        <p className="text-slate-200 leading-relaxed">{item.actionable_recommendation}</p>
                      </div>
                    </div>
                  </div>

                  {/* Savings Pill */}
                  <div className="lg:text-right shrink-0 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase">Estimated Savings</p>
                    <p className="text-lg font-bold text-emerald-400 mt-0.5">
                      {currency_symbol}{item.potential_savings_currency.toFixed(2)}
                      <span className="text-xs text-emerald-300/80 font-normal"> / mo</span>
                    </p>
                    <p className="text-xs text-slate-300 font-medium">{item.potential_savings_kwh} kWh / month</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

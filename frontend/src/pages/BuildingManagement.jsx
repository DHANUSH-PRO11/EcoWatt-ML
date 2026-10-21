import React, { useState, useEffect } from 'react';
import {
  Building2,
  Gauge,
  Plus,
  Trash2,
  RefreshCw,
  MapPin,
  Maximize2,
  Zap,
  AlertTriangle,
  Layers,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import {
  getBuildings,
  getPortfolioSummary,
  createBuilding,
  deleteBuilding,
  registerMeter,
} from '../api/client';
import { MetricCard } from '../components/MetricCard';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const BuildingManagement = () => {
  const [portfolio, setPortfolio] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddMeterModal, setShowAddMeterModal] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form states
  const [newBld, setNewBld] = useState({
    name: '',
    code: '',
    building_type: 'household',
    location: '',
    description: '',
    floor_area_sqm: '',
  });

  const [newMeter, setNewMeter] = useState({
    meter_code: '',
    name: '',
    meter_type: 'main',
    status: 'active',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const [portRes, bldRes] = await Promise.all([
        getPortfolioSummary(),
        getBuildings(),
      ]);
      setPortfolio(portRes);
      setBuildings(bldRes);
      if (bldRes.length > 0 && !selectedBuilding) {
        setSelectedBuilding(bldRes[0]);
      } else if (selectedBuilding) {
        const updated = bldRes.find((b) => b.id === selectedBuilding.id);
        if (updated) setSelectedBuilding(updated);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load building data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBuilding = async (e) => {
    e.preventDefault();
    if (!newBld.name || !newBld.code) return;
    try {
      setFormSubmitting(true);
      setErrorMsg('');
      await createBuilding({
        ...newBld,
        floor_area_sqm: newBld.floor_area_sqm ? parseFloat(newBld.floor_area_sqm) : null,
      });
      setSuccessMsg(`Facility '${newBld.name}' registered successfully!`);
      setShowAddModal(false);
      setNewBld({ name: '', code: '', building_type: 'household', location: '', description: '', floor_area_sqm: '' });
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to register building');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleAddMeter = async (e) => {
    e.preventDefault();
    if (!selectedBuilding || !newMeter.meter_code || !newMeter.name) return;
    try {
      setFormSubmitting(true);
      setErrorMsg('');
      await registerMeter(selectedBuilding.id, newMeter);
      setSuccessMsg(`Meter '${newMeter.meter_code}' registered to ${selectedBuilding.name}!`);
      setShowAddMeterModal(false);
      setNewMeter({ meter_code: '', name: '', meter_type: 'main', status: 'active' });
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to register meter');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteBuilding = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete building '${name}'? This cannot be undone.`)) return;
    try {
      setErrorMsg('');
      await deleteBuilding(id);
      setSuccessMsg(`Building '${name}' removed.`);
      if (selectedBuilding?.id === id) {
        setSelectedBuilding(null);
      }
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Could not delete building');
    }
  };

  if (loading && !portfolio) {
    return <LoadingSpinner text="Loading portfolio & facility infrastructure..." />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Multi-Building & Meter Management</h1>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Enterprise Telemetry
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Configure facilities, track energy intensity (kWh/m²), register smart meters, and compare cross-campus portfolio consumption.
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
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition shadow-lg shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            Register Facility
          </button>
        </div>
      </div>

      {/* Notifications banner */}
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

      {/* Top Metric Cards */}
      {portfolio && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Monitored Facilities"
            value={portfolio.total_buildings}
            unit="Buildings"
            icon={Building2}
            color="emerald"
            subtitle={`${portfolio.total_meters} Registered Smart Meters`}
          />
          <MetricCard
            title="Portfolio Consumption"
            value={portfolio.total_portfolio_consumption_kwh.toLocaleString()}
            unit="kWh"
            icon={Zap}
            color="blue"
            subtitle="Combined Measured Energy"
          />
          <MetricCard
            title="Portfolio Energy Intensity"
            value={portfolio.avg_portfolio_intensity_kwh_per_sqm || '--'}
            unit="kWh / m²"
            icon={Gauge}
            color="amber"
            subtitle="Weighted by Surface Area"
          />
          <MetricCard
            title="Peak Facility"
            value={portfolio.highest_consuming_building || 'Primary HQ'}
            unit=""
            icon={Layers}
            color="purple"
            subtitle="Highest Cumulative Draw"
          />
        </div>
      )}

      {/* Buildings & Meters Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Buildings List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-200">Registered Facilities & Portfolio Stats</h2>
            <span className="text-xs text-slate-400">{buildings.length} Active Sites</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {portfolio?.buildings.map((bld) => {
              const isSelected = selectedBuilding?.id === bld.building_id;
              return (
                <div
                  key={bld.building_id}
                  onClick={() => {
                    const full = buildings.find((b) => b.id === bld.building_id);
                    if (full) setSelectedBuilding(full);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition relative ${
                    isSelected
                      ? 'bg-[#161F30] border-emerald-500/50 shadow-md shadow-emerald-500/10'
                      : 'bg-[#111827] border-[#1F293D] hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100">{bld.building_name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                          {bld.building_type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <span className="text-emerald-400 font-mono font-medium">{bld.building_code}</span>
                      </p>
                    </div>

                    {bld.building_id !== 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBuilding(bld.building_id, bld.building_name);
                        }}
                        className="text-slate-500 hover:text-red-400 p-1 transition"
                        title="Delete building"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs border-t border-[#1F293D] pt-3">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Total Energy</span>
                      <span className="font-semibold text-slate-200">{bld.total_consumption_kwh.toLocaleString()} kWh</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Area Intensity</span>
                      <span className="font-semibold text-amber-400">
                        {bld.energy_intensity_kwh_per_sqm ? `${bld.energy_intensity_kwh_per_sqm} kWh/m²` : '--'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Active Alerts</span>
                      <span className={`font-semibold ${bld.active_anomalies_count > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {bld.active_anomalies_count} Anomalies
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3 h-3 text-blue-400" />
                      {bld.meter_count} Meter{bld.meter_count !== 1 ? 's' : ''}
                    </span>
                    <span className="text-emerald-400 flex items-center gap-0.5">
                      Select Facility <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Building Details & Registered Meters */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-200">Facility Meters & Detail</h2>
            {selectedBuilding && (
              <button
                onClick={() => setShowAddMeterModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition"
              >
                <Plus className="w-3 h-3" /> Add Meter
              </button>
            )}
          </div>

          {selectedBuilding ? (
            <div className="p-5 rounded-xl bg-[#111827] border border-[#1F293D] space-y-5">
              <div>
                <h3 className="font-bold text-lg text-white">{selectedBuilding.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{selectedBuilding.description || 'No description entered.'}</p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-[#1F293D]">
                  <span className="text-slate-400">Site Code</span>
                  <span className="font-mono text-emerald-400 font-semibold">{selectedBuilding.code}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#1F293D]">
                  <span className="text-slate-400">Facility Type</span>
                  <span className="capitalize text-slate-200 font-medium">{selectedBuilding.building_type}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#1F293D]">
                  <span className="text-slate-400">Location</span>
                  <span className="text-slate-200 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-blue-400" /> {selectedBuilding.location}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#1F293D]">
                  <span className="text-slate-400">Gross Floor Area</span>
                  <span className="text-slate-200 font-semibold">
                    {selectedBuilding.floor_area_sqm ? `${selectedBuilding.floor_area_sqm} m²` : 'Not specified'}
                  </span>
                </div>
              </div>

              {/* Registered Meters */}
              <div className="pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Configured Energy Meters ({selectedBuilding.meters?.length || 0})
                </h4>

                <div className="space-y-2">
                  {selectedBuilding.meters && selectedBuilding.meters.length > 0 ? (
                    selectedBuilding.meters.map((meter) => (
                      <div
                        key={meter.id}
                        className="p-3 rounded-lg bg-[#0B0F17] border border-[#1F293D] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <Gauge className="w-4 h-4 text-emerald-400" />
                          <div>
                            <span className="font-semibold text-slate-200 block">{meter.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">{meter.meter_code}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-slate-800 text-slate-300">
                            {meter.meter_type}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400">
                            {meter.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 italic">No meters registered to this facility yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-[#111827] border border-[#1F293D] text-center text-slate-400 text-xs">
              Select a facility on the left to inspect meters and configuration.
            </div>
          )}
        </div>
      </div>

      {/* Register Building Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-[#1F293D] rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Register New Facility</h3>
            <p className="text-xs text-slate-400 mt-1">
              Add a new campus building, household, or laboratory to EcoWatt ML.
            </p>

            <form onSubmit={handleCreateBuilding} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Facility Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Life Sciences Annex"
                  value={newBld.name}
                  onChange={(e) => setNewBld({ ...newBld, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">Code (Unique) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BLD-LS-04"
                    value={newBld.code}
                    onChange={(e) => setNewBld({ ...newBld, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 uppercase focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Building Type</label>
                  <select
                    value={newBld.building_type}
                    onChange={(e) => setNewBld({ ...newBld, building_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="household">Household</option>
                    <option value="classroom">Classroom</option>
                    <option value="laboratory">Laboratory</option>
                    <option value="office">Office</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Location</label>
                <input
                  type="text"
                  placeholder="e.g. North Quad, Sector 3"
                  value={newBld.location}
                  onChange={(e) => setNewBld({ ...newBld, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Gross Floor Area (m²)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 450"
                  value={newBld.floor_area_sqm}
                  onChange={(e) => setNewBld({ ...newBld, floor_area_sqm: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Operational purpose & notes"
                  value={newBld.description}
                  onChange={(e) => setNewBld({ ...newBld, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1F293D]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition"
                >
                  {formSubmitting ? 'Registering...' : 'Register Building'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Meter Modal */}
      {showAddMeterModal && selectedBuilding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-[#1F293D] rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Register Meter to {selectedBuilding.name}</h3>
            <p className="text-xs text-slate-400 mt-1">Add submeter, HVAC circuit, or solar feeder.</p>

            <form onSubmit={handleAddMeter} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Meter Identifier (Code) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MTR-SUB-HVAC-01"
                  value={newMeter.meter_code}
                  onChange={(e) => setNewMeter({ ...newMeter, meter_code: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 uppercase focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Meter Label / Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Central AC & Ventilation Sub-panel"
                  value={newMeter.name}
                  onChange={(e) => setNewMeter({ ...newMeter, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Meter Type</label>
                <select
                  value={newMeter.meter_type}
                  onChange={(e) => setNewMeter({ ...newMeter, meter_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="main">Main Incomer</option>
                  <option value="submeter">Submeter</option>
                  <option value="solar">Solar / PV Inverter</option>
                  <option value="hvac">HVAC Dedicated</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1F293D]">
                <button
                  type="button"
                  onClick={() => setShowAddMeterModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition"
                >
                  {formSubmitting ? 'Adding...' : 'Add Meter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuildingManagement;

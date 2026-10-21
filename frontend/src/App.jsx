import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { BuildingManagement } from './pages/BuildingManagement';
import { EnergyAnalytics } from './pages/EnergyAnalytics';
import { Forecasting } from './pages/Forecasting';
import { AnomalyMonitoring } from './pages/AnomalyMonitoring';
import { BillEstimator } from './pages/BillEstimator';
import { EnergySimulator } from './pages/EnergySimulator';
import { ModelHealth } from './pages/ModelHealth';
import { NotificationsCenter } from './pages/NotificationsCenter';
import { DataImportCenter } from './pages/DataImportCenter';
import { EnergyInsights } from './pages/EnergyInsights';
import { Settings } from './pages/Settings';
import { getSystemStatus } from './api/client';
import { Zap, Shield } from 'lucide-react';

export const App = () => {
  const [systemStatus, setSystemStatus] = useState(null);

  useEffect(() => {
    getSystemStatus()
      .then((data) => setSystemStatus(data))
      .catch((err) => console.warn('Could not fetch system telemetry:', err));
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
        {/* Navigation Bar */}
        <Navbar systemStatus={systemStatus} />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/buildings" element={<BuildingManagement />} />
            <Route path="/analytics" element={<EnergyAnalytics />} />
            <Route path="/forecasting" element={<Forecasting />} />
            <Route path="/anomalies" element={<AnomalyMonitoring />} />
            <Route path="/billing" element={<BillEstimator />} />
            <Route path="/simulator" element={<EnergySimulator />} />
            <Route path="/model-health" element={<ModelHealth />} />
            <Route path="/notifications" element={<NotificationsCenter />} />
            <Route path="/import" element={<DataImportCenter />} />
            <Route path="/insights" element={<EnergyInsights />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Global Footer */}
        <footer className="border-t border-[#1F293D] bg-[#0B0F17] py-6 text-xs text-slate-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-slate-300">EcoWatt ML</span>
              <span className="text-slate-600">&bull;</span>
              <span>Advanced Household & Institutional Energy Intelligence Platform</span>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                FastAPI + Scikit-Learn
              </span>
              <span className="text-slate-600">&bull;</span>
              <span>Isolation Forest Anomaly Detection</span>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;

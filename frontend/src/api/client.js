import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for clear error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'An unexpected API error occurred';
    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);

export const getHealth = () => api.get('/health');
export const getDashboardSummary = (buildingId = null) =>
  api.get('/dashboard/summary', { params: buildingId ? { building_id: buildingId } : {} });

// Buildings & Meters
export const getBuildings = (includeInactive = false) =>
  api.get('/buildings', { params: { include_inactive: includeInactive } });
export const getPortfolioSummary = () => api.get('/buildings/portfolio/summary');
export const getBuildingById = (id) => api.get(`/buildings/${id}`);
export const createBuilding = (data) => api.post('/buildings', data);
export const updateBuilding = (id, data) => api.put(`/buildings/${id}`, data);
export const deleteBuilding = (id) => api.delete(`/buildings/${id}`);
export const getBuildingMeters = (buildingId) => api.get(`/buildings/${buildingId}/meters`);
export const registerMeter = (buildingId, data) => api.post(`/buildings/${buildingId}/meters`, data);

// Energy & Advanced Analytics
export const getEnergyHistory = (params = {}) => api.get('/energy/history', { params });
export const getEnergyAnalytics = (params = {}) => api.get('/energy/analytics', { params });
export const getPeriodComparisons = (buildingId = null) =>
  api.get('/analytics/advanced/comparisons', { params: buildingId ? { building_id: buildingId } : {} });
export const getConsumptionHeatmap = (buildingId = null) =>
  api.get('/analytics/advanced/heatmap', { params: buildingId ? { building_id: buildingId } : {} });
export const getBaseloadPeakAnalysis = (buildingId = null) =>
  api.get('/analytics/advanced/baseload-peak', { params: buildingId ? { building_id: buildingId } : {} });

// Forecasting
export const postForecast = (horizonHours = 24, confidenceLevel = 0.95, buildingId = null, meterId = null) =>
  api.post('/forecast', {
    horizon_hours: horizonHours,
    confidence_level: confidenceLevel,
    building_id: buildingId,
    meter_id: meterId,
  });
export const getForecastHistory = (limit = 72) => api.get('/forecast/history', { params: { limit } });

// Anomalies
export const getAnomalies = (params = {}) => api.get('/anomalies', { params });
export const triggerAnomalyScan = (threshold = 0.70, buildingId = null) =>
  api.post('/anomalies/scan', null, { params: { threshold, building_id: buildingId } });
export const acknowledgeAnomaly = (id) => api.post(`/anomalies/${id}/acknowledge`);
export const resolveAnomaly = (id, resolution_notes) =>
  api.post(`/anomalies/${id}/resolve`, { resolution_notes });
export const investigateAnomaly = (id) => api.get(`/anomalies/${id}/investigate`);
export const submitAnomalyFeedback = (id, falsePositive, notes) =>
  api.post(`/anomalies/${id}/feedback`, { false_positive: falsePositive, investigation_notes: notes });
export const getAnomalyStats = (buildingId = null) =>
  api.get('/anomalies/stats', { params: buildingId ? { building_id: buildingId } : {} });

// Billing & Budget
export const estimateBill = (totalKwh, billingPeriodDays = 30, customTariff = null) =>
  api.post('/bills/estimate', {
    total_kwh: totalKwh,
    billing_period_days: billingPeriodDays,
    custom_tariff: customTariff,
  });
export const getBudgetStatus = (buildingId = null) =>
  api.get('/budget/status', { params: buildingId ? { building_id: buildingId } : {} });
export const getBudgetSettings = (buildingId = null) =>
  api.get('/budget/settings', { params: buildingId ? { building_id: buildingId } : {} });
export const updateBudgetSettings = (data) => api.put('/budget/settings', data);

// What-If Simulator
export const runEnergySimulation = (data) => api.post('/simulator/run', data);

// Carbon Emissions
export const getCarbonAnalytics = (buildingId = null, days = 30) =>
  api.get('/carbon/analytics', { params: { building_id: buildingId, days } });
export const getCarbonSettings = (buildingId = null) =>
  api.get('/carbon/settings', { params: buildingId ? { building_id: buildingId } : {} });
export const updateCarbonSettings = (data) => api.put('/carbon/settings', data);

// Circuits
export const getCircuitAnalytics = (buildingId = null, days = 30) =>
  api.get('/circuits/analytics', { params: { building_id: buildingId, days } });

// Notifications
export const getNotifications = (unreadOnly = false, limit = 40) =>
  api.get('/notifications', { params: { unread_only: unreadOnly, limit } });
export const getUnreadNotificationsCount = () => api.get('/notifications/unread-count');
export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.post('/notifications/read-all');

// Model Health & Drift
export const getModelMetrics = () => api.get('/model/metrics');
export const getModelHealth = () => api.get('/model/health');
export const getTrainingHistory = (limit = 15) => api.get('/model/history', { params: { limit } });
export const retrainModelSafe = (forceSample = false) =>
  api.post('/model/train-safe', null, { params: { force_sample: forceSample } });
export const retrainModel = (forceSample = false) =>
  api.post('/model/train', null, { params: { force_sample: forceSample } });

// Data Import Center
export const previewCsvFile = (formData) =>
  api.post('/import/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const validateCsvFile = (formData) =>
  api.post('/import/validate', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const commitImportData = (payload) => api.post('/import/execute', payload);
export const getImportHistory = () => api.get('/import/history');

// Reports
export const getExecutiveReport = (buildingId = null) =>
  api.get('/reports/summary', { params: buildingId ? { building_id: buildingId } : {} });

// Insights & Settings
export const getInsights = () => api.get('/insights');
export const getTariff = () => api.get('/settings/tariff');
export const updateTariff = (data) => api.put('/settings/tariff', data);
export const getSystemStatus = () => api.get('/settings/system-status');
export const getAuditLogs = (limit = 40, action = null) =>
  api.get('/audit-logs', { params: { limit, action } });

export default api;

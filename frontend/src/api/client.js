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
export const getDashboardSummary = () => api.get('/dashboard/summary');

export const getEnergyHistory = (params = {}) => api.get('/energy/history', { params });
export const getEnergyAnalytics = (params = {}) => api.get('/energy/analytics', { params });

export const postForecast = (horizonHours = 24, confidenceLevel = 0.95) =>
  api.post('/forecast', { horizon_hours: horizonHours, confidence_level: confidenceLevel });
export const getForecastHistory = (limit = 72) => api.get('/forecast/history', { params: { limit } });

export const getAnomalies = (params = {}) => api.get('/anomalies', { params });
export const triggerAnomalyScan = (threshold = 0.70) => api.post('/anomalies/scan', null, { params: { threshold } });
export const acknowledgeAnomaly = (id) => api.post(`/anomalies/${id}/acknowledge`);
export const resolveAnomaly = (id, resolution_notes) =>
  api.post(`/anomalies/${id}/resolve`, { resolution_notes });

export const estimateBill = (totalKwh, billingPeriodDays = 30, customTariff = null) =>
  api.post('/bills/estimate', {
    total_kwh: totalKwh,
    billing_period_days: billingPeriodDays,
    custom_tariff: customTariff,
  });

export const getInsights = () => api.get('/insights');

export const getModelMetrics = () => api.get('/model/metrics');
export const retrainModel = (forceSample = false) =>
  api.post('/model/train', null, { params: { force_sample: forceSample } });

export const getTariff = () => api.get('/settings/tariff');
export const updateTariff = (data) => api.put('/settings/tariff', data);
export const getSystemStatus = () => api.get('/settings/system-status');

export default api;

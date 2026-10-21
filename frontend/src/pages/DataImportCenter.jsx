import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Building2,
  Gauge,
  History,
  ShieldAlert,
  Download,
} from 'lucide-react';
import {
  previewCsvFile,
  validateCsvFile,
  commitImportData,
  getImportHistory,
  getBuildings,
} from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const DataImportCenter = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [history, setHistory] = useState([]);

  // Column mappings
  const [timestampCol, setTimestampCol] = useState('');
  const [energyCol, setEnergyCol] = useState('');
  const [sub1Col, setSub1Col] = useState('');
  const [sub2Col, setSub2Col] = useState('');
  const [sub3Col, setSub3Col] = useState('');
  const [separator, setSeparator] = useState(',');

  // Validation results
  const [validationResult, setValidationResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    try {
      const [bRes, hRes] = await Promise.all([getBuildings(), getImportHistory()]);
      setBuildings(bRes);
      if (bRes.length > 0) setSelectedBuildingId(bRes[0].id);
      setHistory(hRes);
    } catch (err) {
      console.warn('Failed to load initial import metadata:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setValidationResult(null);
    setErrorMsg('');
    setSuccessMsg('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const p = await previewCsvFile(formData);
      setPreview(p);
      setSeparator(p.detected_separator || ',');

      // Auto-detect candidate column names
      const cols = p.columns || [];
      const ts = cols.find((c) => /time|date|timestamp/i.test(c)) || cols[0] || '';
      const nrg = cols.find((c) => /power|energy|kwh|kw|active/i.test(c)) || cols[1] || '';
      const s1 = cols.find((c) => /sub.*1|kitchen/i.test(c)) || '';
      const s2 = cols.find((c) => /sub.*2|laundry/i.test(c)) || '';
      const s3 = cols.find((c) => /sub.*3|hvac|climate/i.test(c)) || '';

      setTimestampCol(ts);
      setEnergyCol(nrg);
      setSub1Col(s1);
      setSub2Col(s2);
      setSub3Col(s3);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to preview CSV file');
    }
  };

  const handleValidate = async () => {
    if (!file || !timestampCol || !energyCol) {
      setErrorMsg('Please specify Timestamp and Energy/Power columns.');
      return;
    }

    try {
      setValidating(true);
      setErrorMsg('');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('timestamp_col', timestampCol);
      formData.append('energy_col', energyCol);
      if (sub1Col) formData.append('sub1_col', sub1Col);
      if (sub2Col) formData.append('sub2_col', sub2Col);
      if (sub3Col) formData.append('sub3_col', sub3Col);
      formData.append('separator', separator);

      const val = await validateCsvFile(formData);
      setValidationResult(val);
    } catch (err) {
      setErrorMsg(err.message || 'CSV validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleCommitImport = async () => {
    if (!validationResult || !validationResult.valid_records || validationResult.valid_records.length === 0) {
      setErrorMsg('No valid records to commit.');
      return;
    }

    try {
      setImporting(true);
      setErrorMsg('');
      const payload = {
        building_id: parseInt(selectedBuildingId) || 1,
        source_name: file?.name || 'CSV Upload',
        is_simulated: false,
        valid_records: validationResult.valid_records,
      };

      const res = await commitImportData(payload);
      setSuccessMsg(`Successfully committed ${res.imported_count} energy readings into database!`);
      setValidationResult(null);
      setFile(null);
      setPreview(null);
      await loadData();
      setTimeout(() => setSuccessMsg(''), 8000);
    } catch (err) {
      setErrorMsg(err.message || 'Database import transaction rolled back');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Data Quality & Import Center</h1>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Atomic Transactions
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Ingest custom CSV energy telemetry with automated preview, strict column validation, rejection diagnostics, and safe rollback.
          </p>
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

      {/* Upload & Validation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1 & 2: Upload and Map */}
        <div className="p-5 rounded-2xl bg-[#111827] border border-[#1F293D] space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">1. Select CSV Dataset</h2>
            <p className="text-xs text-slate-400 mt-0.5">Supports hourly or sub-hourly tabular files (max 25MB).</p>

            <div className="mt-3">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#1F293D] hover:border-emerald-500/50 rounded-xl p-6 cursor-pointer bg-[#0B0F17] transition">
                <UploadCloud className="w-8 h-8 text-emerald-400 mb-2" />
                <span className="text-xs font-medium text-slate-200">{file ? file.name : 'Upload CSV / TXT File'}</span>
                <span className="text-[10px] text-slate-500 mt-1">Click to browse local files</span>
                <input type="file" accept=".csv,.txt" onChange={handleFileChange} className="hidden" />
              </label>
            </div>
          </div>

          {preview && (
            <div className="space-y-4 pt-3 border-t border-[#1F293D]">
              <h2 className="text-sm font-semibold text-slate-200">2. Map Columns</h2>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 block mb-1">Target Facility *</label>
                  <select
                    value={selectedBuildingId}
                    onChange={(e) => setSelectedBuildingId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Timestamp Column *</label>
                  <select
                    value={timestampCol}
                    onChange={(e) => setTimestampCol(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {preview.columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Energy / Power Column (kW or kWh) *</label>
                  <select
                    value={energyCol}
                    onChange={(e) => setEnergyCol(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#1F293D] text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {preview.columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 border-t border-[#1F293D]/60 space-y-2">
                  <span className="text-[11px] text-slate-400 block font-medium">Optional Circuit Submeters</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Kitchen</span>
                      <select
                        value={sub1Col}
                        onChange={(e) => setSub1Col(e.target.value)}
                        className="w-full px-2 py-1.5 rounded bg-[#0B0F17] border border-[#1F293D] text-slate-200 text-[11px]"
                      >
                        <option value="">None</option>
                        {preview.columns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Laundry</span>
                      <select
                        value={sub2Col}
                        onChange={(e) => setSub2Col(e.target.value)}
                        className="w-full px-2 py-1.5 rounded bg-[#0B0F17] border border-[#1F293D] text-slate-200 text-[11px]"
                      >
                        <option value="">None</option>
                        {preview.columns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">HVAC</span>
                      <select
                        value={sub3Col}
                        onChange={(e) => setSub3Col(e.target.value)}
                        className="w-full px-2 py-1.5 rounded bg-[#0B0F17] border border-[#1F293D] text-slate-200 text-[11px]"
                      >
                        <option value="">None</option>
                        {preview.columns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleValidate}
                  disabled={validating}
                  className="w-full mt-2 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold transition flex items-center justify-center gap-1.5"
                >
                  {validating ? 'Validating CSV Records...' : 'Execute Strict Validation'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Validation Inspector & Preview */}
        <div className="lg:col-span-2 space-y-6">
          {validationResult ? (
            <div className="p-5 rounded-2xl bg-[#111827] border border-[#1F293D] space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#1F293D]">
                <div>
                  <h3 className="font-bold text-slate-100 text-base">Validation Diagnostics Report</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Analyzed {validationResult.total_rows} rows from '{file?.name}'.
                  </p>
                </div>

                <button
                  onClick={handleCommitImport}
                  disabled={importing || validationResult.valid_count === 0}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 text-xs font-bold transition shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
                >
                  {importing ? (
                    'Committing Records...'
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5" />
                      Commit {validationResult.valid_count} Valid Readings
                    </>
                  )}
                </button>
              </div>

              {/* Validation Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-[#1F293D]">
                  <span className="text-slate-400 block text-[11px]">Valid Readings</span>
                  <span className="text-lg font-bold text-emerald-400">{validationResult.valid_count}</span>
                  <span className="text-[10px] text-slate-500 block">Ready for ingestion</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-[#1F293D]">
                  <span className="text-slate-400 block text-[11px]">Rejected Rows</span>
                  <span className={`text-lg font-bold ${validationResult.invalid_count > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                    {validationResult.invalid_count}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Excluded automatically</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-[#1F293D]">
                  <span className="text-slate-400 block text-[11px]">Date Horizon</span>
                  <span className="text-xs font-semibold text-slate-200 block truncate">
                    {validationResult.start_date?.slice(0, 10)} to {validationResult.end_date?.slice(0, 10)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Continuous span</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-[#1F293D]">
                  <span className="text-slate-400 block text-[11px]">Cumulative Energy</span>
                  <span className="text-lg font-bold text-blue-400">{validationResult.total_kwh}</span>
                  <span className="text-[10px] text-slate-500 block">kWh total</span>
                </div>
              </div>

              {/* Rejection Inspector */}
              {validationResult.invalid_count > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" /> Sample Rejected Rows & Audit Reasons
                  </h4>

                  <div className="max-h-40 overflow-y-auto rounded-lg border border-red-500/20 bg-red-950/10 p-3 space-y-1.5 text-xs text-red-300">
                    {validationResult.rejected_sample.map((rej, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <span>Row {rej.row}:</span>
                        <span className="text-slate-400">{rej.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-10 rounded-2xl bg-[#111827] border border-[#1F293D] text-center text-slate-400 text-xs space-y-2">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-200">No active file staged for validation.</p>
              <p className="text-slate-500 max-w-sm mx-auto">
                Upload a CSV file and click 'Execute Strict Validation' to preview diagnostics before database ingestion.
              </p>
            </div>
          )}

          {/* Past Imports Provenance History Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-200">Dataset Provenance & Import History</h3>
              </div>
              <span className="text-xs text-slate-400">{history.length} Ingested Datasets</span>
            </div>

            <div className="rounded-xl bg-[#111827] border border-[#1F293D] overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0B0F17] text-slate-400 uppercase text-[10px] tracking-wider border-b border-[#1F293D]">
                  <tr>
                    <th className="px-4 py-2.5">Source Name</th>
                    <th className="px-4 py-2.5">Import Timestamp</th>
                    <th className="px-4 py-2.5">Records</th>
                    <th className="px-4 py-2.5">Date Range</th>
                    <th className="px-4 py-2.5">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F293D]">
                  {history.map((m) => (
                    <tr key={m.id} className="hover:bg-[#161F30]">
                      <td className="px-4 py-2.5 font-medium text-slate-200">{m.source_name}</td>
                      <td className="px-4 py-2.5 text-slate-400 text-[11px]">{m.imported_at}</td>
                      <td className="px-4 py-2.5 font-mono text-emerald-400">{m.total_rows.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-slate-400 text-[11px]">
                        {m.start_date.slice(0, 10)} to {m.end_date.slice(0, 10)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            m.is_simulated ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'
                          }`}
                        >
                          {m.is_simulated ? 'Simulated' : 'Measured'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataImportCenter;

import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FileText, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useRealPlant } from '../../services/realPlantContext';
import { REAL_MACHINES, machineStatus } from '../../services/plantStatus';
import './DashboardPages.css';

const TCO2_PER_KWH = 0.0004; // implied by the steel dataset: its CO2 column is derived from kWh

/**
 * Replay summary built from the real replayed feeds: steel-plant energy per day (actual vs the
 * calendar baseline), CO2 derived from kWh, and the alerts raised so far. This is NOT a
 * compliance report: the energy data is a 2018 recording and CO2 is computed from kWh.
 */
const ReportsScreen = () => {
  const { feeds, alerts } = useRealPlant();
  const [scope, setScope] = useState('All intervals replayed so far');
  const isWide = window.innerWidth > 900;

  const energy = feeds.energy;
  const rows = useMemo(() => {
    const byDay = new Map();
    for (const m of energy.hist) {
      const day = String(m.date).slice(0, 10);
      const d = byDay.get(day) || { day, actual: 0, expected: 0, n: 0 };
      d.actual += m.kwh; d.expected += m.expected; d.n += 1;
      byDay.set(day, d);
    }
    return [...byDay.values()].map((d) => ({
      day: d.day.slice(5), date: d.day, intervals: d.n,
      actual: Number(d.actual.toFixed(1)),
      expected: Number(d.expected.toFixed(1)),
      excess: Number((d.actual - d.expected).toFixed(1)),
      tco2: Number((d.actual * TCO2_PER_KWH).toFixed(3)),
    }));
  }, [energy.hist]);

  const e = energy.latest;
  const bySeverity = (s) => alerts.filter((a) => a.severity === s).length;
  const fullDays = scope === 'Complete days only' ? rows.filter((r) => r.intervals >= 96) : rows;

  const handleExport = (type) => {
    const stamp = new Date().toLocaleString();
    const head = [
      ['CARBON EDGE - REPLAY SUMMARY (NOT A COMPLIANCE REPORT)'],
      [`Generated: ${stamp}`],
      ['Data: recorded 2018 steel-plant energy readings (UCI #851), replayed. CO2 is derived from kWh at 0.0004 t/kWh.'],
      [`Alerts raised so far: High ${bySeverity('High')}, Warning ${bySeverity('Warning')}, Low ${bySeverity('Low')}`],
      [],
    ];
    const cols = ['Day (MM-DD)', 'Intervals', 'Actual kWh', 'Expected kWh', 'Excess kWh', 'CO2 (t, derived)'];
    const body = fullDays.map((r) => [r.day, r.intervals, r.actual, r.expected, r.excess, r.tco2]);
    const name = 'CarbonEdge_ReplaySummary';

    if (type === 'PDF') {
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text('CarbonEdge replay summary (not a compliance report)', 14, 20);
      doc.setFontSize(9);
      head.slice(1, 4).forEach((l, i) => doc.text(doc.splitTextToSize(l[0], 180), 14, 28 + i * 8));
      doc.autoTable({ head: [cols], body, startY: 56, theme: 'grid', headStyles: { fillColor: [41, 128, 185], textColor: 255 } });
      doc.save(`${name}.pdf`);
      return;
    }
    const ws = XLSX.utils.aoa_to_sheet([...head, cols, ...body]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Replay_Summary');
    if (type === 'CSV') XLSX.writeFile(wb, `${name}.csv`, { bookType: 'csv' });
    else XLSX.writeFile(wb, `${name}.xlsx`);
  };

  const Stat = ({ label, value, color }) => (
    <div className="esg-stat">
      <span className="stat-value" style={{ color }}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );

  const excessPct = e && e.cum_kwh > 0 ? (e.cum_excess_kwh / e.cum_kwh) * 100 : null;

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h1>Replay Summary &amp; Energy Analytics</h1>
      </div>

      <div className="reports-content">
        <div className={`reports-top ${isWide ? 'row' : 'col'}`}>
          <div className="report-card score-card flex-2">
            <h2>Plant Summary (replay)</h2>
            <div className="esg-stats-row" style={{ flexDirection: 'column', gap: 12 }}>
              <Stat label="Energy used so far" value={e ? `${e.cum_kwh.toLocaleString()} kWh` : '—'} color="var(--color-blue)" />
              <Stat label="Above baseline" value={excessPct == null ? '—' : `${excessPct.toFixed(1)}%`} color="var(--color-orange)" />
              <Stat label="CO₂ (derived from kWh)" value={e ? `${e.cum_tco2} t` : '—'} color="var(--color-success)" />
              <Stat label="Alerts (High / Warning / Low)" value={`${bySeverity('High')} / ${bySeverity('Warning')} / ${bySeverity('Low')}`} color="var(--color-purple)" />
            </div>
            <div style={{ marginTop: 12 }}>
              {REAL_MACHINES.map((m) => {
                const s = machineStatus(m.id, feeds);
                return <p key={m.id} className="alert-desc">{m.title}: {s.text}</p>;
              })}
            </div>
          </div>

          <div className="report-card chart-card flex-3">
            <h2>Energy per day: actual vs baseline (kWh)</h2>
            <div className="chart-wrapper">
              {fullDays.length === 0 ? (
                <p className="alert-desc">No energy data yet. Connect the replay backend on the Dashboard.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={fullDays} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-surface-light)" />
                    <XAxis dataKey="day" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--color-surface-dark)', borderColor: 'var(--color-surface-light)' }} />
                    <Legend iconType="circle" />
                    <Bar dataKey="actual" name="Actual" fill="var(--color-error)" radius={[4, 4, 0, 0]} barSize={16} isAnimationActive={false} />
                    <Bar dataKey="expected" name="Baseline" fill="var(--color-success)" radius={[4, 4, 0, 0]} barSize={16} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="report-card generate-card">
          <h2>Export</h2>
          <div className={`generate-controls ${isWide ? 'row' : 'col'}`}>
            <div className="input-group flex-1">
              <label>Rows</label>
              <select value={scope} onChange={(ev) => setScope(ev.target.value)}>
                <option>All intervals replayed so far</option>
                <option>Complete days only</option>
              </select>
            </div>
          </div>
          <p className="alert-desc">
            Recorded 2018 steel-plant data, replayed. The feed keeps the latest 192 intervals (about 2 days), so the first day may be partial. CO₂ is computed from kWh, not measured. This is not an audited or regulatory report.
          </p>
          <div className="export-actions">
            <button className="btn-export pdf" onClick={() => handleExport('PDF')}><FileText size={18} /> Export as PDF</button>
            <button className="btn-export excel" onClick={() => handleExport('Excel')}><FileSpreadsheet size={18} /> Export as Excel</button>
            <button className="btn-export csv" onClick={() => handleExport('CSV')}><Download size={18} /> Export as CSV</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsScreen;

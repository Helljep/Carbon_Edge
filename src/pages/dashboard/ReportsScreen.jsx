import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { FileText, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './DashboardPages.css';

const hardcodedSnapshots = {
  "Current Baseline": [
    { month: 'Jan', actual: 42.0, predicted: 38.0, target: 30.0 },
    { month: 'Feb', actual: 45.0, predicted: 40.0, target: 31.0 },
    { month: 'Mar', actual: 40.0, predicted: 39.0, target: 30.0 },
    { month: 'Apr', actual: 38.0, predicted: 37.0, target: 29.0 },
    { month: 'May', actual: 36.0, predicted: 35.0, target: 28.0 },
    { month: 'Jun', actual: 34.0, predicted: 34.0, target: 27.0 },
  ],
  "Q1 2024 Summary": [
    { month: 'Jan', actual: 55.0, predicted: 38.0, target: 30.0 },
    { month: 'Feb', actual: 58.0, predicted: 40.0, target: 31.0 },
    { month: 'Mar', actual: 52.0, predicted: 39.0, target: 30.0 },
    { month: 'Apr', actual: 48.0, predicted: 37.0, target: 29.0 },
    { month: 'May', actual: 45.0, predicted: 35.0, target: 28.0 },
    { month: 'Jun', actual: 42.0, predicted: 34.0, target: 27.0 },
  ],
  "Peak Production Cycle": [
    { month: 'Jan', actual: 72.0, predicted: 68.0, target: 60.0 },
    { month: 'Feb', actual: 75.0, predicted: 70.0, target: 61.0 },
    { month: 'Mar', actual: 70.0, predicted: 69.0, target: 60.0 },
    { month: 'Apr', actual: 68.0, predicted: 67.0, target: 59.0 },
    { month: 'May', actual: 66.0, predicted: 65.0, target: 58.0 },
    { month: 'Jun', actual: 64.0, predicted: 64.0, target: 57.0 },
  ],
  "Maintenance Downtime": [
    { month: 'Jan', actual: 12.0, predicted: 15.0, target: 10.0 },
    { month: 'Feb', actual: 15.0, predicted: 18.0, target: 11.0 },
    { month: 'Mar', actual: 10.0, predicted: 12.0, target: 10.0 },
    { month: 'Apr', actual: 8.0, predicted: 10.0, target: 9.0 },
    { month: 'May', actual: 6.0, predicted: 8.0, target: 8.0 },
    { month: 'Jun', actual: 5.0, predicted: 6.0, target: 7.0 },
  ]
};

const snapshotOptions = Object.keys(hardcodedSnapshots);

const ReportsScreen = () => {
  const [selectedReportType, setSelectedReportType] = useState("Monthly Summary");
  const [selectedDateRange, setSelectedDateRange] = useState("Last 30 Days");
  const [selectedSnapshot, setSelectedSnapshot] = useState("Current Baseline");

  const emissionsData = hardcodedSnapshots[selectedSnapshot];
  const isWide = window.innerWidth > 900;

  const handleExport = (type) => {
    // Formatting data for official government report
    const reportDate = new Date().toLocaleDateString();
    let reportData = [];
    
    // Adding Metadata Headers
    reportData.push(["CARBON EDGE - OFFICIAL ESG COMPLIANCE REPORT"]);
    reportData.push([`Generated On: ${reportDate}`]);
    reportData.push([`Reporting Period: ${selectedDateRange}`]);
    reportData.push([`Report Context: ${selectedSnapshot}`]);
    reportData.push([]);
    
    // Column Headers
    reportData.push(["Month", "Actual Emissions (tCO2e)", "Target Limit (tCO2e)", "Compliance Status", "Variance (%)"]);
    
    // Data Rows
    emissionsData.forEach(item => {
      const variance = (((item.actual - item.target) / item.target) * 100).toFixed(2);
      const status = item.actual <= item.target ? "COMPLIANT" : "EXCEEDS LIMIT";
      reportData.push([item.month, item.actual, item.target, status, `${variance}%`]);
    });
    
    reportData.push([]);
    reportData.push(["DECLARATION: I hereby certify under penalty of law that the information provided is true, accurate, and complete."]);
    reportData.push(["Authorized Signatory: _________________________"]);
    reportData.push(["Date: _________________________"]);
    
    if (type === 'Excel' || type === 'CSV') {
      const ws = XLSX.utils.aoa_to_sheet(reportData);
      ws['!cols'] = [{wch: 15}, {wch: 25}, {wch: 25}, {wch: 20}, {wch: 15}];
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Compliance_Report");
      const fileName = `CarbonEdge_GovReport_${selectedSnapshot.replace(/\s+/g, '_')}.${type === 'Excel' ? 'xlsx' : 'csv'}`;
      if (type === 'CSV') {
        XLSX.writeFile(wb, fileName, { bookType: 'csv' });
      } else {
        XLSX.writeFile(wb, fileName);
      }
    } else if (type === 'PDF') {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(16);
      doc.setTextColor(41, 128, 185);
      doc.text("CARBON EDGE - OFFICIAL ESG COMPLIANCE REPORT", 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text(`Generated On: ${reportDate}`, 14, 30);
      doc.text(`Reporting Period: ${selectedDateRange}`, 14, 36);
      doc.text(`Report Context: ${selectedSnapshot}`, 14, 42);
      
      // Table Data
      const tableColumn = reportData[5];
      const tableRows = reportData.slice(6, reportData.length - 3);
      
      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 50,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        alternateRowStyles: { fillColor: [240, 240, 240] }
      });
      
      const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 20 : 150;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text("DECLARATION:", 14, finalY);
      doc.setFontSize(9);
      doc.text("I hereby certify under penalty of law that the information provided is true, accurate, and complete.", 14, finalY + 6);
      
      doc.text("Authorized Signatory: _________________________________", 14, finalY + 25);
      doc.text("Date: _________________________________", 14, finalY + 35);
      
      doc.save(`CarbonEdge_GovReport_${selectedSnapshot.replace(/\s+/g, '_')}.pdf`);
    }
  };

  const CircularProgress = ({ percent, value, label, size = 200, strokeWidth = 16 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - percent * circumference;

    return (
      <div className="circular-progress" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle 
            stroke="var(--color-surface-light)" 
            fill="transparent" 
            strokeWidth={strokeWidth} 
            r={radius} 
            cx={size / 2} 
            cy={size / 2} 
          />
          <circle 
            stroke="var(--color-success)" 
            fill="transparent" 
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            r={radius} 
            cx={size / 2} 
            cy={size / 2} 
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          />
        </svg>
        <div className="progress-content">
          <span className="p-val">{value}</span>
          <span className="p-label">{label}</span>
        </div>
      </div>
    );
  };

  const ESGStat = ({ label, value, color }) => (
    <div className="esg-stat">
      <span className="stat-value" style={{ color }}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h1>Reports & ESG Analytics</h1>
      </div>

      <div className="reports-content">
        <div className={`reports-top ${isWide ? 'row' : 'col'}`}>
          <div className="report-card score-card flex-2">
            <h2>ESG Performance Score</h2>
            <div className="score-ring-container">
              <CircularProgress percent={0.88} value="88" label="Excellent" />
            </div>
            <div className="esg-stats-row">
              <ESGStat label="Environmental" value="92%" color="var(--color-success)" />
              <ESGStat label="Social" value="85%" color="var(--color-blue)" />
              <ESGStat label="Governance" value="87%" color="var(--color-purple)" />
            </div>
          </div>

          <div className="report-card chart-card flex-3">
            <h2>CO₂ Emissions (tCO₂e)</h2>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={emissionsData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-surface-light)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                    contentStyle={{ backgroundColor: 'var(--color-surface-dark)', borderColor: 'var(--color-surface-light)' }} 
                  />
                  <Legend iconType="circle" />
                  <Bar dataKey="actual" name="Actual" fill="var(--color-error)" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="predicted" name="Predicted" fill="var(--color-orange)" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="target" name="Target" fill="var(--color-success)" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="report-card generate-card">
          <h2>Generate New Report</h2>
          <div className={`generate-controls ${isWide ? 'row' : 'col'}`}>
            <div className="input-group flex-1">
              <label>Report Type</label>
              <select value={selectedReportType} onChange={e => setSelectedReportType(e.target.value)}>
                <option>Monthly Summary</option>
                <option>Quarterly Report</option>
                <option>Annual ESG Report</option>
              </select>
            </div>
            <div className="input-group flex-1">
              <label>Date Range</label>
              <select value={selectedDateRange} onChange={e => setSelectedDateRange(e.target.value)}>
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
                <option>Year to Date</option>
                <option>Custom Range</option>
              </select>
            </div>
            <div className="input-group flex-1">
              <label>Data Snapshot</label>
              <select value={selectedSnapshot} onChange={e => setSelectedSnapshot(e.target.value)}>
                {snapshotOptions.map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
          </div>

          <div className="export-actions">
            <button className="btn-export pdf" onClick={() => handleExport('PDF')}>
              <FileText size={18} /> Export as PDF
            </button>
            <button className="btn-export excel" onClick={() => handleExport('Excel')}>
              <FileSpreadsheet size={18} /> Export as Excel
            </button>
            <button className="btn-export csv" onClick={() => handleExport('CSV')}>
              <Download size={18} /> Export as CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsScreen;

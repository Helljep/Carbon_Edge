import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Decimation,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register the required Chart.js components, including Decimation
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Decimation,
  Filler
);

export default function LiveTelemetryChart({ data, title }) {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    // Disable animations for performance when data updates rapidly
    animation: false, 
    // Optimize parsing for large datasets
    parsing: true,
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
    plugins: {
      title: {
        display: title ? true : false,
        text: title,
        color: '#e2e8f0', // Light slate color for dark mode
        font: { size: 16, family: 'system-ui' }
      },
      legend: {
        labels: { color: '#94a3b8' }
      },
      // Decimation is crucial for industrial dashboards
      decimation: {
        enabled: true,
        algorithm: 'lttb', // Largest Triangle Three Buckets - great for preserving data spikes!
        samples: 100, // Maximum number of points to display at once
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(16, 27, 36, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        type: 'category',
        ticks: { color: '#64748b' },
        grid: { color: '#334155', drawBorder: false } // Subtle grid lines
      },
      y: {
        type: 'linear',
        ticks: { color: '#64748b' },
        grid: { color: '#334155', drawBorder: false },
        beginAtZero: false,
      },
    },
  };

  return (
    <div style={{ width: '100%', height: '300px' }}>
      <Line options={options} data={data} />
    </div>
  );
}

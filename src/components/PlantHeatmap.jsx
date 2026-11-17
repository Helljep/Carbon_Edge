import React from 'react';
import NeonCard from './NeonCard';
import './PlantHeatmap.css';

const PlantHeatmap = ({ isMobile = false, selectedMachine = 'Kiln A' }) => {
  const getStatusColor = (index, name) => {
    if (name === selectedMachine) return 'var(--color-accent)'; // highlight
    const hash = selectedMachine.length;
    if ((hash + index) % 5 === 0) return 'var(--color-error)';
    if ((hash + index) % 3 === 0) return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  const Node = ({ label, color, hasAlert, alertText, x, y, isSelected }) => (
    <div className="heatmap-node" style={{ left: x, top: y }}>
      <div 
        className="node-dot-container"
        style={{
          borderColor: isSelected ? 'var(--color-accent)' : color,
          borderWidth: isSelected ? '3px' : '2px',
          boxShadow: `0 0 ${isSelected ? '12px 4px' : '8px 2px'} ${(isSelected ? 'var(--color-accent)' : color)}80`
        }}
      >
        <div className="node-dot" style={{ backgroundColor: color }}></div>
      </div>
      
      {hasAlert && (
        <div className="node-alert" style={{ borderColor: color, color: color }}>
          {alertText}
        </div>
      )}
      
      <div className="node-label">{label}</div>
    </div>
  );

  return (
    <NeonCard>
      <div className="heatmap-header">
        <h3>Plant Heatmap Visualization</h3>
        {!isMobile && (
          <div className="heatmap-legend">
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: 'var(--color-success)', boxShadow: '0 0 4px var(--color-success)' }}></span>
              <span>Normal</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: 'var(--color-warning)', boxShadow: '0 0 4px var(--color-warning)' }}></span>
              <span>Drift</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: 'var(--color-error)', boxShadow: '0 0 4px var(--color-error)' }}></span>
              <span>Anomaly</span>
            </div>
          </div>
        )}
      </div>

      <div className="heatmap-body">
        {isMobile ? (
          <div className="heatmap-mobile">
            {/* Simple mobile rows simulating the layout */}
            {["Kiln A", "Kiln B", "Motor 7", "Motor 8", "Motor 9"].map((m, i) => (
              <div key={i} className="heatmap-mobile-item" style={{ borderColor: `${getStatusColor(i, m)}40`, backgroundColor: `${getStatusColor(i, m)}1A` }}>
                <div className="item-left">
                  <span className="legend-dot" style={{ backgroundColor: getStatusColor(i, m) }}></span>
                  <span className="item-name">{m}</span>
                </div>
                <span className="item-status" style={{ color: getStatusColor(i, m) }}>
                  {getStatusColor(i, m) === 'var(--color-success)' ? 'Normal' : 'Drift/Anomaly'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="heatmap-desktop">
            <div className="heatmap-line top-line"></div>
            <div className="heatmap-line bottom-line"></div>
            
            <Node label="Kiln A" color={getStatusColor(1, "Kiln A")} isSelected={selectedMachine === 'Kiln A'} x={80} y={30} />
            <Node label="Kiln B" color={getStatusColor(2, "Kiln B")} isSelected={selectedMachine === 'Kiln B'} x={200} y={30} />
            <Node label="Kiln C" color={getStatusColor(3, "Kiln C")} isSelected={selectedMachine === 'Kiln C'} hasAlert={(selectedMachine.length + 3) % 5 === 0} alertText="Anomaly 1350°C" x={320} y={30} />
            
            <Node label="Motor 3" color={getStatusColor(4, "Motor 3")} x={80} y={130} />
            <Node label="Motor 4" color={getStatusColor(5, "Motor 4")} x={200} y={130} />
            <Node label="Motor 5" color={getStatusColor(6, "Motor 5")} x={320} y={130} />
            <Node label="Motor 6" color={getStatusColor(7, "Motor 6")} x={440} y={130} />
            <Node label="Motor 7" color={getStatusColor(8, "Motor 7")} x={560} y={130} />
          </div>
        )}
      </div>
    </NeonCard>
  );
};

export default PlantHeatmap;

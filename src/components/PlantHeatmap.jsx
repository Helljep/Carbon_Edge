import React from 'react';
import NeonCard from './NeonCard';
import { useRealPlant } from '../services/realPlantContext';
import { REAL_MACHINES, LEVEL_COLOR, machineStatus } from '../services/plantStatus';
import './PlantHeatmap.css';

const POSITIONS = [80, 240, 400];

/** Live status of each real machine, taken from its latest replayed message. */
const PlantHeatmap = ({ isMobile = false, selectedMachine = 'bearing' }) => {
  const { feeds } = useRealPlant();
  const nodes = REAL_MACHINES.map((m, i) => {
    const st = machineStatus(m.id, feeds);
    return { ...m, ...st, color: LEVEL_COLOR[st.level], x: POSITIONS[i] };
  });

  const Node = ({ label, color, text, x, y, isSelected }) => (
    <div className="heatmap-node" style={{ left: x, top: y }}>
      <div
        className="node-dot-container"
        style={{
          borderColor: isSelected ? 'var(--color-accent)' : color,
          borderWidth: isSelected ? '3px' : '2px',
          boxShadow: `0 0 ${isSelected ? '12px 4px' : '8px 2px'} ${isSelected ? 'var(--color-accent)' : color}80`,
        }}
      >
        <div className="node-dot" style={{ backgroundColor: color }}></div>
      </div>
      <div className="node-alert" style={{ borderColor: color, color }}>{text}</div>
      <div className="node-label">{label}</div>
    </div>
  );

  return (
    <NeonCard>
      <div className="heatmap-header">
        <h3>Plant Status (live, from recorded real data)</h3>
        {!isMobile && (
          <div className="heatmap-legend">
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: 'var(--color-success)', boxShadow: '0 0 4px var(--color-success)' }}></span>
              <span>Normal</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: 'var(--color-warning)', boxShadow: '0 0 4px var(--color-warning)' }}></span>
              <span>Watch</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: 'var(--color-error)', boxShadow: '0 0 4px var(--color-error)' }}></span>
              <span>Fault</span>
            </div>
          </div>
        )}
      </div>

      <div className="heatmap-body">
        {isMobile ? (
          <div className="heatmap-mobile">
            {nodes.map((n) => (
              <div key={n.id} className="heatmap-mobile-item" style={{ borderColor: `${n.color}40`, backgroundColor: `${n.color}1A` }}>
                <div className="item-left">
                  <span className="legend-dot" style={{ backgroundColor: n.color }}></span>
                  <span className="item-name">{n.title}</span>
                </div>
                <span className="item-status" style={{ color: n.color }}>{n.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="heatmap-desktop">
            <div className="heatmap-line top-line"></div>
            <div className="heatmap-line bottom-line"></div>
            {nodes.map((n) => (
              <Node key={n.id} label={n.title} color={n.color} text={n.text} x={n.x} y={30} isSelected={selectedMachine === n.id} />
            ))}
          </div>
        )}
      </div>
    </NeonCard>
  );
};

export default PlantHeatmap;

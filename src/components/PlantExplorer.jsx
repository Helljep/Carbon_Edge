import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useRealPlant } from '../services/realPlantContext';
import { REAL_MACHINES, DEFAULT_MACHINE, LEVEL_COLOR, machineStatus } from '../services/plantStatus';
import './PlantExplorer.css';

const Section = ({ title, items, selectedItem, onSelect }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="explorer-section">
      <div className="section-header" onClick={() => setExpanded(!expanded)}>
        <span className="section-title">{title}</span>
        <span className="section-icon">{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div className="section-items">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`explorer-item ${selectedItem === item.id ? 'selected' : ''}`}
              onClick={() => onSelect(item.id)}
            >
              <div
                className="status-dot"
                style={{
                  backgroundColor: item.color,
                  boxShadow: `0 0 4px 1px ${item.color}80`
                }}
              ></div>
              <span className="item-title" style={{ color: selectedItem === item.id ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                {item.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PlantExplorer = ({ onMachineSelected }) => {
  const { feeds } = useRealPlant();
  const [selectedItem, setSelectedItem] = useState(DEFAULT_MACHINE);
  const [searchQuery, setSearchQuery] = useState('');

  // group the real machines; the dot colour is each machine's live status
  const allData = {};
  REAL_MACHINES.forEach((m) => {
    (allData[m.group] = allData[m.group] || []).push({
      id: m.id,
      title: m.title,
      color: LEVEL_COLOR[machineStatus(m.id, feeds).level],
    });
  });

  const filteredData = {};
  Object.entries(allData).forEach(([section, items]) => {
    const match = items.filter((i) => i.title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (match.length > 0) filteredData[section] = match;
  });

  const handleSelect = (id) => {
    setSelectedItem(id);
    if (onMachineSelected) onMachineSelected(id);
  };

  return (
    <div className="plant-explorer">
      <div className="explorer-header">
        <h2>Plant Explorer</h2>
      </div>
      
      <div className="explorer-search">
        <span className="search-icon"><Search size={18} /></span>
        <input
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="explorer-list">
        {Object.entries(filteredData).map(([section, items]) => (
          <Section
            key={section}
            title={section}
            items={items}
            selectedItem={selectedItem}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default PlantExplorer;

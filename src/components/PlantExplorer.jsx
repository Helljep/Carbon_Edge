import React, { useState } from 'react';
import { Search } from 'lucide-react';
import MachineData from '../data/machineData'; // I will create this static data file later
import './PlantExplorer.css';

// Using mock static data to match Flutter exactly
const ALL_DATA = {
  "Kilns": [
    { title: "Kiln A", color: "var(--color-success)" },
    { title: "Kiln B", color: "var(--color-success)" },
    { title: "Kiln C", color: "var(--color-success)" },
  ],
  "Furnaces": [
    { title: "Furnace Line 1", color: "var(--color-success)" },
    { title: "Furnace Line 2", color: "var(--color-success)" },
    { title: "Furnace Line 3", color: "var(--color-warning)" },
  ],
  "Motors": [
    { title: "Motor 1", color: "var(--color-success)" },
    { title: "Motor 7", color: "var(--color-error)" },
  ],
  "Fans": [
    { title: "Fans 1", color: "var(--color-success)" },
  ],
  "Compressors": [
    { title: "Machine", color: "var(--color-success)" },
  ],
  "Mills": [
    { title: "Mills", color: "var(--color-success)" },
    { title: "Compressors", color: "var(--color-success)" },
  ],
};

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
              className={`explorer-item ${selectedItem === item.title ? 'selected' : ''}`}
              onClick={() => onSelect(item.title)}
            >
              <div
                className="status-dot"
                style={{
                  backgroundColor: item.color,
                  boxShadow: `0 0 4px 1px ${item.color}80`
                }}
              ></div>
              <span className="item-title" style={{ color: selectedItem === item.title ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
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
  const [selectedItem, setSelectedItem] = useState('Kiln A');
  const [searchQuery, setSearchQuery] = useState('');

  const getFilteredData = () => {
    if (!searchQuery) return ALL_DATA;
    
    const filtered = {};
    Object.entries(ALL_DATA).forEach(([section, items]) => {
      const match = items.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()));
      if (match.length > 0) {
        filtered[section] = match;
      }
    });
    return filtered;
  };

  const filteredData = getFilteredData();

  const handleSelect = (title) => {
    setSelectedItem(title);
    if (onMachineSelected) onMachineSelected(title);
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

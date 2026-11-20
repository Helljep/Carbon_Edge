import React from 'react';
import NeonCard from './NeonCard';
import { ArrowUp, ArrowDown } from 'lucide-react';
import './KPICard.css';

const KPICard = ({
  title,
  value,
  unit,
  trend,
  isPositiveTrend,
  trendDir,
  icon: IconComponent,
  accentColor,
  isWeb = false,
}) => {
  return (
    <NeonCard borderColor={accentColor} glow={true} padding="16px">
      <div className="kpi-card">
        <div className="kpi-header">
          {IconComponent && <IconComponent color={accentColor} size={isWeb ? 24 : 20} />}
          <span className="kpi-title" style={{ fontSize: isWeb ? '14px' : '12px' }}>
            {title}
          </span>
        </div>
        
        <div className="kpi-spacer"></div>
        
        <div className="kpi-body">
          <span className="kpi-value" style={{ fontSize: isWeb ? '28px' : '24px' }}>
            {value}
          </span>
          <span className="kpi-unit" style={{ fontSize: isWeb ? '16px' : '14px' }}>
            {unit}
          </span>
        </div>
        
        {trend != null && trend !== '' && (
          <div className="kpi-footer">
            {(trendDir ? trendDir === 'up' : isPositiveTrend) ? (
              <ArrowUp color={isPositiveTrend ? 'var(--color-success)' : 'var(--color-error)'} size={14} />
            ) : (
              <ArrowDown color={isPositiveTrend ? 'var(--color-success)' : 'var(--color-error)'} size={14} />
            )}
            <span 
              className="kpi-trend" 
              style={{ 
                color: isPositiveTrend ? 'var(--color-success)' : 'var(--color-error)',
                fontSize: isWeb ? '14px' : '12px'
              }}
            >
              {trend}
            </span>
          </div>
        )}
      </div>
    </NeonCard>
  );
};

export default KPICard;

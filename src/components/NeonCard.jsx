import React from 'react';
import './NeonCard.css';

const NeonCard = ({
  children,
  className = '',
  borderColor,
  glow = false,
  padding = '16px',
  margin = '0',
  borderRadius = '16px',
}) => {
  const defaultBorderColor = 'rgba(255, 255, 255, 0.1)'; // Similar to surfaceLight
  const actualBorderColor = borderColor || defaultBorderColor;

  const style = {
    margin,
    padding,
    borderRadius,
    borderColor: actualBorderColor,
    boxShadow: glow && borderColor ? `0 0 12px 2px ${borderColor}33` : 'none',
  };

  return (
    <div className={`neon-card ${className}`} style={style}>
      {children}
    </div>
  );
};

export default NeonCard;

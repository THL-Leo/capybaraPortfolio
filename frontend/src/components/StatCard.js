import React from 'react';

const StatCard = ({ label, value, subtitle, icon, accent = 'var(--capy-primary)' }) => (
  <div className="stat-card" style={{ '--stat-accent': accent }}>
    {icon && (
      <div className="stat-card-icon" style={{ background: `${accent}18`, color: accent }}>
        {icon}
      </div>
    )}
    <div className="stat-card-label">{label}</div>
    <p className="stat-card-value">{value}</p>
    {subtitle && <p className="stat-card-sub">{subtitle}</p>}
  </div>
);

export default StatCard;

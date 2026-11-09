import React from 'react';

/**
 * High-precision tabular monospace formatter for B2B numerical telemetry
 */
export function AnimatedNumber({
  value = 0,
  decimals = 2,
  prefix = '',
  suffix = '',
  className = '',
}) {
  const num = Number(value) || 0;
  const formatted = num.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={`font-mono-num tabular-nums ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/**
 * Crisp static label renderer (no slow marketing animations)
 */
export function RevealText({ text = '', className = '' }) {
  return <span className={className}>{text}</span>;
}

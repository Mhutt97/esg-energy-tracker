import React, { useState, useEffect, useRef } from 'react';

/**
 * Smoothly interpolates numerical KPI values with cubic-out easing
 */
export function AnimatedNumber({
  value = 0,
  decimals = 2,
  prefix = '',
  suffix = '',
  duration = 550,
  className = '',
}) {
  const target = Number(value) || 0;
  const [displayValue, setDisplayValue] = useState(target);
  const prevValueRef = useRef(target);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = target;
    if (Math.abs(endVal - startVal) < 0.0001) {
      setDisplayValue(endVal);
      prevValueRef.current = endVal;
      return;
    }

    let rafId;
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Cubic ease-out: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setDisplayValue(endVal);
        prevValueRef.current = endVal;
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [target, duration]);

  const formatted = displayValue.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/**
 * Staggered word-by-word editorial text reveal animation
 */
export function RevealText({ text = '', className = '', delayMs = 0 }) {
  const words = String(text).split(' ');
  return (
    <span className={`inline-flex flex-wrap gap-x-[0.28em] ${className}`}>
      {words.map((word, idx) => (
        <span key={`${word}-${idx}`} className="overflow-hidden inline-block">
          <span
            className="inline-block animate-word-reveal"
            style={{
              animationDelay: `${delayMs + idx * 38}ms`,
              animationFillMode: 'both',
            }}
          >
            {word}
          </span>
        </span>
      ))}
    </span>
  );
}

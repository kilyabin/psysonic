import React from 'react';
import { useTranslation } from 'react-i18next';

export default function StarRating({
  value,
  onChange,
  disabled = false,
  labelKey = 'albumDetail.ratingLabel',
  className = '',
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  labelKey?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [hover, setHover] = React.useState(0);
  const [pulseStar, setPulseStar] = React.useState<number | null>(null);
  const [clearShrinkStar, setClearShrinkStar] = React.useState<number | null>(null);
  /** After clear: ignore hover so stars stay grey until pointer leaves widget or next click */
  const [suppressHoverPreview, setSuppressHoverPreview] = React.useState(false);

  React.useEffect(() => {
    if (value > 0) setSuppressHoverPreview(false);
  }, [value]);

  const effectiveHover = suppressHoverPreview ? 0 : hover;
  const filled = (n: number) => (effectiveHover || value) >= n;

  const handleStarClick = (n: number) => {
    if (disabled) return;
    setSuppressHoverPreview(false);

    const next = value === n ? 0 : n;
    onChange(next);
    setHover(0);

    setPulseStar(null);
    setClearShrinkStar(null);

    if (next === 0) {
      setSuppressHoverPreview(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setClearShrinkStar(n));
      });
    } else {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPulseStar(n));
      });
    }
  };

  const handleContainerLeave = () => {
    setHover(0);
    setSuppressHoverPreview(false);
  };

  return (
    <div
      className={`star-rating${disabled ? ' star-rating--disabled' : ''}${suppressHoverPreview ? ' star-rating--suppress-hover' : ''} ${className}`.trim()}
      role="radiogroup"
      aria-label={t(labelKey)}
      aria-disabled={disabled}
      onMouseLeave={disabled ? undefined : handleContainerLeave}
    >
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`star ${filled(n) ? 'filled' : ''}${pulseStar === n ? ' star--pulse' : ''}${clearShrinkStar === n ? ' star--clear-shrink' : ''}`}
          onMouseEnter={() => !disabled && !suppressHoverPreview && setHover(n)}
          onClick={() => handleStarClick(n)}
          onAnimationEnd={e => {
            if (e.currentTarget !== e.target) return;
            const name = e.animationName;
            if (name === 'star-rating-star-pulse') {
              setPulseStar(s => (s === n ? null : s));
            }
            if (name === 'star-rating-star-clear-shrink') {
              setClearShrinkStar(s => (s === n ? null : s));
            }
          }}
          disabled={disabled}
          aria-label={`${n}`}
          role="radio"
          aria-checked={filled(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

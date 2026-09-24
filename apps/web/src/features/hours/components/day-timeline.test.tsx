import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DayTimeline, scaleLabel, timelineScale } from './day-timeline';

const BAND = { bandStartMinutes: 7 * 60, bandEndMinutes: 19 * 60 };

describe('timelineScale', () => {
  it('is the working band when every day fits in it', () => {
    const scale = timelineScale(BAND, [{ start: '07:30', end: '16:30' }]);
    expect(scaleLabel(scale)).toBe('07:00–19:00');
  });

  it('widens to whole hours to take in an early start and a late end', () => {
    const scale = timelineScale(BAND, [
      { start: '06:15', end: '12:00' },
      { start: '10:00', end: '20:10' },
      { start: '', end: '' },
    ]);
    expect(scaleLabel(scale)).toBe('06:00–21:00');
  });

  it('runs to 24:00 for a day that ends past midnight', () => {
    expect(scaleLabel(timelineScale(BAND, [{ start: '18:00', end: '02:00' }]))).toBe('07:00–24:00');
  });
});

describe('DayTimeline', () => {
  const scale = { from: 7 * 60, to: 19 * 60 };

  it('draws the span to scale, named for screen readers', () => {
    render(<DayTimeline start="07:30" end="13:00" scale={scale} upcoming={false} />);
    const bar = screen.getByRole('img', { name: '07:30 to 13:00' });
    expect(bar.firstElementChild).toHaveStyle({ left: '4.2%', width: '45.8%' });
  });

  it('draws nothing until both times read', () => {
    const { container } = render(
      <DayTimeline start="07:3" end="13:00" scale={scale} upcoming={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('clamps an unsaved span past the scale to the track', () => {
    render(<DayTimeline start="05:00" end="21:00" scale={scale} upcoming />);
    expect(screen.getByRole('img').firstElementChild).toHaveStyle({ left: '0%', width: '100%' });
  });
});

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeatherIcon } from './WeatherIcon';

describe('WeatherIcon', () => {
  it('labels each forecast kind for accessibility and tooltip', () => {
    render(<WeatherIcon kind="rain" />);
    const el = screen.getByRole('img', { name: /weather: rain/i });
    expect(el).toHaveAttribute('title', 'Rain');
  });

  it('renders nothing when there is no forecast for the day', () => {
    const { container } = render(<WeatherIcon />);
    expect(container).toBeEmptyDOMElement();
  });
});

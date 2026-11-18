import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, it } from 'vitest';
import { HabitTimeInput } from '../components/HabitTimeInput';

it('converts AM and PM selections to the saved 24-hour time', () => {
  function Example() {
    const [value, setValue] = useState('');
    return <><HabitTimeInput label="Start time" value={value} onChange={setValue} /><output>{value}</output></>;
  }
  render(<Example />);
  fireEvent.change(screen.getByLabelText('Start time hour'), { target: { value: '12' } });
  expect(screen.getByText('00:00')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Start time AM or PM'), { target: { value: 'PM' } });
  fireEvent.change(screen.getByLabelText('Start time minute'), { target: { value: '30' } });
  expect(screen.getByText('12:30')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Start time hour'), { target: { value: '9' } });
  expect(screen.getByText('21:30')).toBeTruthy();
});

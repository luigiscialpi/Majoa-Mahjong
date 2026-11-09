import { act } from 'react';
import { AccessibilityInfo } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { useReduceMotion } from './useReduceMotion';

afterEach(() => jest.restoreAllMocks());

describe('useReduceMotion', () => {
  test('parte da falso, prende la risposta del sistema e segue i cambiamenti', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    let onChange: (value: boolean) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_event: string, handler: (value: boolean) => void) => {
      onChange = handler;
      return { remove };
    }) as unknown as typeof AccessibilityInfo.addEventListener);

    const { result, unmount } = await renderHook(() => useReduceMotion());
    expect(result.current).toBe(true);
    await act(() => onChange(false));
    expect(result.current).toBe(false);
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

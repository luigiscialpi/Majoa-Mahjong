import { act } from 'react';
import { AccessibilityInfo } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { useReduceMotion } from './useReduceMotion';

afterEach(() => jest.restoreAllMocks());

describe('useReduceMotion', () => {
  test('parte da falso, prende la risposta del sistema e segue i cambiamenti', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true);
    let onChange: (value: boolean) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementationOnce(((_event: string, handler: (value: boolean) => void) => {
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

  test('con il sistema a «no» non aggiorna mai lo stato (nessun disegno in più)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(false);
    let onChange: (value: boolean) => void = () => {};
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementationOnce(((_event: string, handler: (value: boolean) => void) => {
      onChange = handler;
      return { remove: jest.fn() };
    }) as unknown as typeof AccessibilityInfo.addEventListener);
    let renders = 0;
    const { result } = await renderHook(() => {
      renders += 1;
      return useReduceMotion();
    });
    await act(() => onChange(false));
    expect(result.current).toBe(false);
    expect(renders).toBe(1);
  });
});

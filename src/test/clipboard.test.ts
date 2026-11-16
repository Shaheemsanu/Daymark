import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '../utils/clipboard';

const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalExecCommand) Object.defineProperty(document, 'execCommand', originalExecCommand);
  else Reflect.deleteProperty(document, 'execCommand');
  document.body.replaceChildren();
});

describe('Clipboard copying', () => {
  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('Transaction details')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('Transaction details');
  });

  it.each(['unavailable', 'blocked'])('copies selected text when the Clipboard API is %s', async mode => {
    vi.stubGlobal('navigator', mode === 'blocked' ? { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } } : {});
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    const execCommand = vi.fn(() => {
      const input = document.activeElement as HTMLTextAreaElement;
      expect(input.value).toBe('Account balance: 100.00');
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
      return true;
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    expect(await copyText('Account balance: 100.00')).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('reports failure and removes the temporary field when selection copying is blocked', async () => {
    vi.stubGlobal('navigator', {});
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
    expect(await copyText('Transaction')).toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });
});

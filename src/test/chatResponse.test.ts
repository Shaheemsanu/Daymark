import { expect, it, vi } from 'vitest';
import { readChatResponse } from '../features/ai/chatResponse';

it('preserves every character across split JSON lines and UTF-8 bytes', async () => {
  const bytes = new TextEncoder().encode([
    { type: 'context', context: { source: 'expenses', start: '2026-11-01', end: '2026-11-17', recordCount: 17 } },
    { type: 'delta', text: 'Total: ₹ ' },
    { type: 'delta', text: '7,920.00\nAll records included.' },
    { type: 'done' },
  ].map(event => JSON.stringify(event)).join('\n'));
  const body = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
  const update = vi.fn();
  await readChatResponse(new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } }), update);
  expect(update).toHaveBeenLastCalledWith({ text: 'Total: ₹ 7,920.00\nAll records included.', context: { source: 'expenses', start: '2026-11-01', end: '2026-11-17', recordCount: 17 } });
});

it.each([
  ['missing completion', [{ type: 'delta', text: 'Partial reply' }], /interrupted/],
  ['provider failure', [{ type: 'delta', text: 'Partial reply' }, { type: 'error', error: 'Gemini took too long to respond.' }], /took too long/],
] as const)('rejects %s rather than accepting a partial answer', async (_name, events, error) => {
  const response = new Response(events.map(event => JSON.stringify(event)).join('\n') + '\n', { headers: { 'Content-Type': 'application/x-ndjson' } });
  await expect(readChatResponse(response, vi.fn())).rejects.toThrow(error);
});

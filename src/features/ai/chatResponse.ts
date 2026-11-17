import type { ContextMeta } from './chatScope';

export type ChatEvent =
  | { type: 'context'; context: ContextMeta }
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

// A network chunk can split a JSON line or even a multibyte currency symbol.
export async function readChatResponse(response: Response, update: (answer: { text: string; context?: ContextMeta }) => void) {
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The chat backend is unavailable. Check your server setup.');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not complete the chat request.');
    update({ text: result.answer, context: result.context });
    return;
  }
  if (!response.ok || !response.body) throw new Error('Could not start the AI reply. Please try again.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', text = '', complete = false;
  let context: ContextMeta | undefined;
  const consume = (line: string) => {
    if (!line.trim() || complete) return;
    const event: ChatEvent = JSON.parse(line);
    if (event.type === 'error') throw new Error(event.error);
    if (event.type === 'context') context = event.context;
    if (event.type === 'delta') text += event.text;
    if (event.type === 'done') complete = true;
    if (text) update({ text, context });
  };
  try {
    while (!complete) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) consume(line);
      if (done) { consume(buffer); break; }
    }
    if (!complete || !text.trim()) throw new Error('The AI reply was interrupted. Please try again.');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

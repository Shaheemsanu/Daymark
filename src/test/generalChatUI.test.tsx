import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import GeneralChatScreen from '../features/ai/GeneralChatScreen';
import AssistantMessage from '../features/ai/AssistantMessage';

import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({ supabase: { auth: {
  getSession: vi.fn(async () => ({ data: { session: { access_token: 'user-token' } }, error: null })),
  refreshSession: vi.fn(async () => ({ data: { session: null }, error: null })),
} } }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('hides record IDs in complete and streaming AI replies', () => {
  const { rerender } = render(<AssistantMessage text="Groceries (ID: dae141c1-ba2c-4d4a-98be-f34f46c6e431)" />);
  expect(screen.getByText('Groceries')).toBeInTheDocument();
  expect(screen.queryByText(/dae141c1/)).toBeNull();
  rerender(<AssistantMessage text="Groceries (ID: dae141c1-ba2c" />);
  expect(screen.getByText('Groceries')).toBeInTheDocument();
});

it('continues a conversation with completed turns and skips a failed question', async () => {
  let count = 0;
  const request = vi.fn(async (url: string, _options?: RequestInit) => {
    if (url.endsWith('/status')) return Response.json({ configured: true });
    count++;
    if (count === 2) return Response.json({ error: 'Please try again.' }, { status: 503 });
    return Response.json({ answer: count === 1 ? 'Food was highest.' : 'Here are the details.' });
  });
  vi.stubGlobal('fetch', request);
  render(<GeneralChatScreen active />);
  await screen.findByText('Ready to chat');
  const input = screen.getByLabelText('Message Daymark AI');
  const send = (text: string) => { fireEvent.change(input, { target: { value: text } }); fireEvent.click(screen.getByRole('button', { name: 'Send message' })); };
  send('What was highest?');
  await screen.findByText('Food was highest.');
  await waitFor(() => expect(input).not.toBeDisabled());
  send('Why?');
  await screen.findByRole('alert');
  await waitFor(() => expect(input).not.toBeDisabled());
  send('Tell me more');
  await screen.findByText('Here are the details.');
  const calls = request.mock.calls.filter(([url]) => url.endsWith('/chat'));
  expect(JSON.parse(String(calls[1][1]?.body))).toMatchObject({ message: 'Why?', history: [{ role: 'user', text: 'What was highest?' }, { role: 'assistant', text: 'Food was highest.' }] });
  expect(JSON.parse(String(calls[2][1]?.body))).toMatchObject({ message: 'Tell me more', history: [{ role: 'user', text: 'What was highest?' }, { role: 'assistant', text: 'Food was highest.' }] });
});

it('refreshes the session and retries once when the chat backend returns 401', async () => {
  vi.mocked(supabase!.auth.refreshSession).mockResolvedValueOnce({ data: { session: { access_token: 'fresh-token' } }, error: null } as never);
  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/status')) return Response.json({ configured: true });
    const auth = (options?.headers as Record<string, string>)?.Authorization;
    if (auth === 'Bearer user-token') return Response.json({ error: 'Your session expired. Sign in again.' }, { status: 401 });
    return Response.json({ answer: 'Recovered with fresh token' });
  });
  vi.stubGlobal('fetch', request);
  render(<GeneralChatScreen active />);
  await screen.findByText('Ready to chat');
  fireEvent.change(screen.getByLabelText('Message Daymark AI'), { target: { value: 'Hello' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByText('Recovered with fresh token');
  const chatCalls = request.mock.calls.filter(([url]) => url.endsWith('/chat'));
  expect(chatCalls).toHaveLength(2);
  expect((chatCalls[1][1]?.headers as Record<string, string>).Authorization).toBe('Bearer fresh-token');
});

it('shows streamed text before completion and retries without keeping a partial answer', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
  const request = vi.fn(async (url: string, _options?: RequestInit) => url.endsWith('/status') ? Response.json({ configured: true }) : new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } }));
  vi.stubGlobal('fetch', request);
  render(<GeneralChatScreen active />);
  await screen.findByText('Ready to chat');
  fireEvent.change(screen.getByLabelText('Message Daymark AI'), { target: { value: 'Summarize' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  const emit = (event: object) => controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
  await act(async () => { emit({ type: 'delta', text: 'First part of the answer' }); });
  expect(await screen.findByText('First part of the answer')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  await act(async () => { controller.close(); });
  expect(await screen.findByRole('alert')).toHaveTextContent('interrupted');
  expect(screen.queryByText('First part of the answer')).toBeNull();
  request.mockImplementation(async (url: string) => Response.json(url.endsWith('/status') ? { configured: true } : { answer: 'Complete answer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Complete answer');
  const calls = request.mock.calls.filter(([url]) => url.endsWith('/chat'));
  expect(calls[0][1]?.headers).toMatchObject({ Accept: 'application/x-ndjson' });
  expect(JSON.parse(String(calls[1][1]?.body))).toMatchObject({ message: 'Summarize', history: [] });
  await waitFor(() => expect(screen.getAllByLabelText('Your message')).toHaveLength(1));
});

it('renders AI Markdown as formatted text while keeping user messages literal', async () => {
  const answer = 'Here is your summary:\n\n* **Total Income:** ₹ 7,920.00\n* **Total Expenses:** ₹ 4,217.00\n\n<script>alert("unsafe")</script>';
  vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.endsWith('/status') ? { configured: true } : { answer })));
  render(<GeneralChatScreen active />);
  await screen.findByText('Ready to chat');
  fireEvent.change(screen.getByLabelText('Message Daymark AI'), { target: { value: '**Summarize** my records' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  const reply = await screen.findByLabelText('Daymark AI answer');
  expect(within(reply).getAllByRole('listitem')).toHaveLength(2);
  expect(within(reply).getByText('Total Income:').tagName).toBe('STRONG');
  expect(reply).toHaveTextContent('₹ 7,920.00');
  expect(reply).not.toHaveTextContent('**');
  expect(reply.querySelector('script')).toBeNull();
  expect(screen.getByLabelText('Your message')).toHaveTextContent('**Summarize** my records');
});

it('opens directly to Daymark AI, sends the data scope and starts a new conversation', async () => {
  const request = vi.fn(async (url: string, _options?: RequestInit) => Response.json(url.endsWith('/status') ? { configured: true, model: 'test-model' } : { answer: 'Hello from Daymark AI' }));
  vi.stubGlobal('fetch', request);
  render(<GeneralChatScreen active />);
  await screen.findByText('Ready to chat');
  fireEvent.change(screen.getByLabelText('Message Daymark AI'), { target: { value: 'Hello' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByText('Hello from Daymark AI');
  const options = request.mock.calls.find(([url]) => url.endsWith('/chat'))![1]!;
  expect(JSON.parse(String(options.body))).toMatchObject({ source: 'expenses', message: 'Hello', history: [] });
  expect(screen.queryByRole('tablist')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Daymark AI' })).toBeInTheDocument();
  expect(options.headers).toMatchObject({ Authorization: 'Bearer user-token' });
  expect(screen.getByText('Read-only access')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
  expect(screen.queryByText('Hello from Daymark AI')).toBeNull();
});

it('disables sending until the backend is configured', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ configured: false })));
  render(<GeneralChatScreen active />);
  await screen.findByText('Connection needs setup');
  fireEvent.change(screen.getByLabelText('Message Daymark AI'), { target: { value: 'Hello' } });
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
});

it('sends the chosen scope and clears the conversation when changing data sources', async () => {
  const request = vi.fn(async (url: string, _options?: RequestInit) => Response.json(url.endsWith('/status') ? { configured: true, model: 'test-model' } : { answer: 'Your recorded notes summary', context: { source: 'notes', start: '2026-11-01', end: '2026-11-17', recordCount: 2, facts: [{ label: 'Unfinished notes', value: '2' }] } }));
  vi.stubGlobal('fetch', request);
  render(<GeneralChatScreen active />);
  await screen.findByText('Ready to chat');
  fireEvent.change(screen.getByLabelText('AI data source'), { target: { value: 'notes' } });
  fireEvent.change(screen.getByLabelText('AI start date'), { target: { value: '2026-11-01' } });
  fireEvent.change(screen.getByLabelText('AI end date'), { target: { value: '2026-11-17' } });
  fireEvent.change(screen.getByLabelText('Message Daymark AI'), { target: { value: 'Summarize my notes' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByText('Your recorded notes summary');
  expect(screen.getByText(/Source: Todo notes.*2 retrieved records/)).toBeInTheDocument();
  expect(screen.getByText('Read-only access')).toBeInTheDocument();
  fireEvent.click(screen.getByText('View source figures'));
  expect(screen.getByText('Unfinished notes')).toBeInTheDocument();
  expect(screen.getByText(/Check important details against your records/)).toBeInTheDocument();
  const call = request.mock.calls.find(([url]) => url.endsWith('/chat'))![1]!;
  expect(JSON.parse(String(call.body))).toMatchObject({ source: 'notes', start: '2026-11-01', end: '2026-11-17', history: [] });
  fireEvent.change(screen.getByLabelText('AI data source'), { target: { value: 'habits' } });
  expect(screen.queryByText('Your recorded notes summary')).toBeNull();
  expect(screen.getByLabelText('AI data source')).toHaveValue('habits');
});

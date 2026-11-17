import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import GeneralChatScreen from '../features/ai/GeneralChatScreen';

vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'user-token' } }, error: null })) } } }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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

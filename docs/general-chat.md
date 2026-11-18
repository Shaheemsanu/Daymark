# Daymark AI chat

Open the sparkle **Daymark AI** button beside Refresh in the header. This screen
uses Gemini for read-only analysis of your records. General chat is not available.
Messages remain in memory while switching screens. New chat or signing out
clears them. No chat history is stored in Supabase.

Set `GEMINI_GENERAL_API_KEY` in the ignored local `.env` or production server
environment. Optional `GEMINI_GENERAL_MODEL` defaults to `gemini-3.5-flash-lite`,
a lightweight model for responsive data analysis. Requests use one attempt with
a 30-second timeout; transient failures can be retried from the chat screen.
The existing Supabase URL and public anon key verify the signed-in user. No
database migration or service-role key is needed. Never use a VITE_ prefix for
the Gemini key, commit it, or embed it in client code.

Restart `npm run dev` after changing environment variables. For production,
run `npm run build` then `npm start`. Static hosting or `vite preview` alone
cannot serve the chat API.

Every request requires a valid data source and date range. The endpoint verifies
identity and retrieves selected records before sending context and up to eight
earlier messages to Gemini. General-chat requests are rejected. No tools, SQL,
editing actions, or deletion actions are exposed.
You can ask follow-up questions in the same conversation; the latest four
completed question-and-answer pairs provide context. An unanswered question is
excluded if you send a different message after an error.
Chat output supports Markdown formatting; raw HTML is skipped and never executed. Keys and raw provider
errors are excluded from API responses. Limits are 10 questions/minute per
signed-in user with one active request. Model access, billing, quota and key
validity must be verified with your Google AI Studio account.

Replies stream into the chat as Gemini generates them, so reading can begin
before the full answer is ready. The selected model, complete retrieved context,
calculated figures and output limit are unchanged. Retrieval requests up to 1,000
rows per page to reduce round trips and still checks all pages for completeness.
Records are freshly retrieved for every question, without caching old snapshots.
Repeated record fields are encoded compactly in the prompt to reduce the amount
of data sent to Gemini while preserving the record details used for analysis.
Internal record IDs are replaced in the prompt with short references that retain
links between related records.
Streaming improves time to visible text; provider startup and generation time
still depend on Gemini and the network. Interrupted replies are discarded and
can be retried without adding partial text to conversation history.

## Read-only data analysis

In **Daymark AI**, choose Expenses, Habits, Tasks, Todo notes, or Wellness
journal, set dates (up to 366 days), and ask a question. The same configured
`gemini-3.5-flash-lite` model retrieves selected records before answering. This is
structured retrieval with context, without training or a vector database.

Examples: “Which categories have the most spending?”, “Explain my recorded habit
activity”, “Summarize unfinished notes”, or “What could I improve based on these
records?” Suggestions do not perform actions. Answers show the selected source,
dates and retrieved record count. Changing source or dates clears chat
history so previous records do not carry into another scope.

The server verifies the signed-in user, uses that user's JWT and existing
Supabase RLS, and adds an explicit user_id filter to every fixed REST GET query.
Client-provided user IDs, SQL and data snapshots are ignored. No service-role
key, write query, callable editing tool, arbitrary URL or model-generated code
is accepted. Normal app screens retain their existing editing permissions; the
AI path has only a read adapter. No schema changes are needed.

Only the selected source is sent to Google Gemini. Todo note images/media are
never selected. Wellness mode includes the selected journal text and saved
wellness values. Notes use UTC creation dates. Task and habit definitions are
current, with recorded entries filtered by date; missing entries are unknown,
not failures. Expense summaries exclude transfers, balance adjustments, opening
balances and card repayments. Calendar-day averages include days without
spending. Budget targets and actual account balances are not supplied.

Retrieval is paginated and limited to 2,000 records per table and 180,000 context
characters. Oversized or failed retrieval stops the answer rather than sending
partial records to Gemini. A shorter date range may be needed. Titles and record
text are treated as untrusted data, not instructions. Answers can still be wrong;
check important findings against the app's reports. No chat records are saved
to Supabase and no database table is altered by the AI feature.

## Checking answer accuracy

Each answer includes **View source figures**, showing counts and expense figures
calculated directly on the server from the fetched records. These figures are
returned separately from the AI-generated explanation. Expense totals use cents,
category shares use the selected expense total, and daily breakdowns include
every calendar day. Invalid financial amounts block analysis. Pagination also
rejects duplicate IDs, changing totals and incomplete responses instead of
silently producing an answer from partial records.

Choose the relevant source and dates, ask a specific question, and compare
important claims against the source figures and the app's reports. Figures
reflect the data saved in your account. The model is instructed to separate
recorded facts from suggestions and say when information is missing, but these
checks cannot guarantee that every generated interpretation is correct.

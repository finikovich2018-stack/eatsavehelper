const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

type ClaudeMessage = {
  role: 'user';
  content: string | Array<Record<string, unknown>>;
};

export async function callClaudeViaWorker(params: {
  messages: ClaudeMessage[];
  maxTokens?: number;
  userId?: number | string;
  isPremium?: boolean;
}): Promise<string> {
  if (!WORKER_URL) {
    throw new Error('WORKER_URL not configured');
  }

  const res = await fetch(`${WORKER_URL}/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: params.messages,
      max_tokens: params.maxTokens ?? 1500,
      userId: params.userId,
      isPremium: params.isPremium ?? false,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Worker request failed');
  }

  return data.text as string;
}

import { ApiError } from '@/lib/client-api';

/** Run an async UI mutation with consistent ApiError handling. */
export async function runMutation<T>(
  action: () => Promise<T>,
  onError: (message: string) => void,
  fallbackMessage = 'Request failed'
): Promise<T | null> {
  try {
    return await action();
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error && error.message
          ? error.message
          : fallbackMessage;
    onError(message);
    return null;
  }
}

export function mutationErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallbackMessage;
}

import { useState } from "react";

export interface LimitState {
  remaining: number | null; // null = aun no sabemos (primera llamada)
  limit: number;
}

export function useAiLimit(defaultLimit: number) {
  const [state, setState] = useState<LimitState>({
    remaining: defaultLimit, // mostrar dots llenos desde el inicio
    limit: defaultLimit,
  });

  function decrement() {
    setState((s) => ({
      ...s,
      remaining: s.remaining !== null ? Math.max(0, s.remaining - 1) : null,
    }));
  }

  function updateFromHeaders(headers: Headers) {
    const remaining = headers.get("X-Ratelimit-Remaining") ?? headers.get("x-ratelimit-remaining");
    const limit = headers.get("X-Ratelimit-Limit") ?? headers.get("x-ratelimit-limit");
    if (remaining !== null) {
      setState({
        remaining: parseInt(remaining, 10),
        limit: limit ? parseInt(limit, 10) : defaultLimit,
      });
    }
  }

  function markExhausted() {
    setState((s) => ({ ...s, remaining: 0 }));
  }

  const canUse = state.remaining === null || state.remaining > 0;
  const used = state.remaining === null ? 0 : state.limit - state.remaining;

  return { remaining: state.remaining, limit: state.limit, used, canUse, decrement, updateFromHeaders, markExhausted };
}

export type RealtimeEvent = {
  type: "QUESTION_CREATED" | "QUESTION_LIKED" | "QUESTION_UNLIKED" | "ANSWER_CREATED" | "ANSWER_UPDATED" | "ANSWER_DELETED" | "COMMENT_CREATED" | "UPVOTE_CREATED" | "UPVOTE_REMOVED" | "USER_FOLLOWED" | "NOTIFICATION_CREATED" | "COLLEGE_MEMBERSHIP_CHANGED" | "MARKETS_SYNCED" | "MARKET_CREATED" | "PRODUCE_REPORTED" | "ISSUE_CREATED" | "ISSUE_SUPPORTED" | "ISSUE_UNSUPPORTED" | "ISSUE_RESOLVED";
  payload: Record<string, unknown>;
};

type Listener = (event: RealtimeEvent) => void;
const globalRealtime = globalThis as unknown as { realtimeListeners?: Map<string, Set<Listener>> };
const listeners = globalRealtime.realtimeListeners ?? new Map<string, Set<Listener>>();
if (!globalRealtime.realtimeListeners) globalRealtime.realtimeListeners = listeners;

export function subscribe(channel: string, listener: Listener) {
  const channelListeners = listeners.get(channel) ?? new Set<Listener>();
  channelListeners.add(listener);
  listeners.set(channel, channelListeners);
  return () => {
    channelListeners.delete(listener);
    if (!channelListeners.size) listeners.delete(channel);
  };
}

export function publish(channel: string, event: RealtimeEvent) {
  listeners.get(channel)?.forEach((listener) => listener(event));
}

export function publishPublic(event: RealtimeEvent) {
  publish("public", event);
}

export function publishUser(userId: string, event: RealtimeEvent) {
  publish(`user:${userId}`, event);
}

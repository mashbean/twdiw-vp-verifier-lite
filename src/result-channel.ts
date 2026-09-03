const enc = new TextEncoder();

export interface ResultSubscription {
  type: "subscribe";
  resultKey: string;
}

export function parseResultSubscription(message: string): ResultSubscription | null {
  if (message.length > 256) return null;
  try {
    const value = JSON.parse(message) as { type?: unknown; resultKey?: unknown };
    return value.type === "subscribe"
      && typeof value.resultKey === "string"
      && /^[0-9a-f]{64}$/.test(value.resultKey)
      ? { type: "subscribe", resultKey: value.resultKey }
      : null;
  } catch {
    return null;
  }
}

export function resultKeysEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  const leftBytes = enc.encode(left);
  const rightBytes = enc.encode(right);
  let different = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    different |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return different === 0;
}

export function isAuthorizedResultSocket(socket: WebSocket): boolean {
  const attachment = socket.deserializeAttachment() as { authorized?: unknown } | null;
  return attachment?.authorized === true;
}

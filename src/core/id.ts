export const createRecordId = (): string => {
  const crypto = globalThis.crypto;

  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // TODO: replace this fallback with a cryptographically secure React Native source.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (placeholder) => {
    const random = Math.floor(Math.random() * 16);
    const value = placeholder === 'x' ? random : (random & 0x3) | 0x8;

    return value.toString(16);
  });
};

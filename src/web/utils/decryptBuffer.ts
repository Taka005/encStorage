export const decryptBuffer = async (
  data: Uint8Array<ArrayBuffer>, 
  key: CryptoKey, 
  iv: Uint8Array<ArrayBuffer>, 
  tag: Uint8Array<ArrayBuffer>
): Promise<ArrayBuffer> => {
  const combined = new Uint8Array(data.byteLength + tag.byteLength);
  combined.set(new Uint8Array(data), 0);
  combined.set(tag, data.byteLength);

  return await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined);
};
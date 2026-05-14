const hexToUint8 = (hex: string) =>{
  const match = hex.match(/.{1,2}/g);
  if (!match) throw new Error("Invalid hex string");

  return new Uint8Array(match.map(byte => parseInt(byte, 16)));
}

export { hexToUint8 };
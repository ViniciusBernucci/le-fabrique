import { BadRequestException } from "@nestjs/common";
/** Bound stored avatars to raster formats and small dimensions; SVG and oversized headers fail closed. */
export function validateAvatar(value: string | null | undefined): void {
  if (!value) return;
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  const bytes = match ? Buffer.from(match[2] ?? "", "base64") : Buffer.alloc(0);
  let width = 0,
    height = 0;
  if (
    match?.[1] === "png" &&
    bytes.length >= 24 &&
    bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" &&
    bytes.subarray(12, 16).toString() === "IHDR"
  ) {
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
  } else if (match?.[1] === "jpeg" && bytes.subarray(0, 3).toString("hex") === "ffd8ff") {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 255) break;
      const marker = bytes[offset + 1] ?? 0;
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 7) {
        height = bytes.readUInt16BE(offset + 5);
        width = bytes.readUInt16BE(offset + 7);
        break;
      }
      offset += 2 + length;
    }
  }
  if (!width || !height || width > 256 || height > 256 || value.length > 24000)
    throw new BadRequestException("Use uma imagem PNG ou JPEG de até 256 pixels.");
}

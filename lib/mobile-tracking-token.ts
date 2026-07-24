import { createHmac, timingSafeEqual } from "node:crypto";

export type TrackingTokenPayload = {
  motoristaId: string;
  jornadaId: string;
  veiculoId: string | null;
  exp: number;
};

function secret() {
  const value = process.env.MOBILE_TRACKING_SECRET;
  if (!value || value.length < 32) {
    throw new Error("MOBILE_TRACKING_SECRET deve possuir pelo menos 32 caracteres.");
  }
  return value;
}

function sign(encodedPayload: string) {
  return createHmac("sha256", secret()).update(encodedPayload).digest("base64url");
}

export function createTrackingToken(payload: TrackingTokenPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyTrackingToken(token: string): TrackingTokenPayload | null {
  const [encodedPayload, suppliedSignature] = token.split(".");
  if (!encodedPayload || !suppliedSignature) return null;

  const expectedSignature = sign(encodedPayload);
  const expected = Buffer.from(expectedSignature);
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as TrackingTokenPayload;

    if (!payload.motoristaId || !payload.jornadaId || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

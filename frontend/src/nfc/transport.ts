/**
 * Credential transport layer - how the phone hands its short-lived tap token to a reader.
 *
 * Only `simulatedNfcTransport` exists today. It does NOT use NFC hardware: the token is
 * sent over HTTPS to the backend's simulated reader endpoint. To add real NFC later,
 * implement `CredentialTransport` with Host Card Emulation (Android, e.g. via a native
 * module such as react-native-hce) or Apple's NFC & SE Platform (iOS, entitlement
 * required) and swap it in - screens and the verification API stay unchanged.
 */
import { api } from "@/src/api";
import type { VerificationResult } from "@/src/types";

export interface CredentialTransport {
  readonly kind: "simulated" | "hce" | "apple-se";
  readonly isHardware: boolean;
  readonly label: string;
  present(token: string, buildingId: string, method: "nfc" | "qr"): Promise<VerificationResult>;
}

export const simulatedNfcTransport: CredentialTransport = {
  kind: "simulated",
  isHardware: false,
  label: "Simulated NFC (no hardware)",
  present: (token, buildingId, method) =>
    api<VerificationResult>("/me/simulated-tap", { method: "POST", body: { token, building_id: buildingId, method } }),
};

export const activeTransport: CredentialTransport = simulatedNfcTransport;

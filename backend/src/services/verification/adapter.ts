/**
 * LicenceVerifier adapter interface.
 * Swap MockDigiLockerVerifier for a real implementation by changing the
 * factory function below — no other code changes needed.
 */

export interface VerificationResult {
  status: "VERIFIED" | "FAILED";
  verifiedAt: Date | null;
  details: string;
}

export interface LicenceVerifier {
  verify(licenceNumber: string, name: string, dob?: string): Promise<VerificationResult>;
}

/**
 * Mock DigiLocker verifier.
 * Deterministic: licence numbers ending in an odd digit verify,
 * even digits fail. Configurable delay to simulate real API latency.
 */
export class MockDigiLockerVerifier implements LicenceVerifier {
  private delayMs: number;

  constructor(delayMs = 1500) {
    this.delayMs = delayMs;
  }

  async verify(licenceNumber: string, name: string): Promise<VerificationResult> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));

    // Get the last digit of the licence number
    const lastChar = licenceNumber.replace(/\D/g, "").slice(-1);
    const lastDigit = parseInt(lastChar || "0", 10);
    const passes = lastDigit % 2 !== 0; // odd = verified, even = failed

    if (passes) {
      return {
        status: "VERIFIED",
        verifiedAt: new Date(),
        details: `[MOCK] DigiLocker verification successful for ${name} (licence: ${licenceNumber})`,
      };
    } else {
      return {
        status: "FAILED",
        verifiedAt: null,
        details: `[MOCK] DigiLocker verification failed for ${name} (licence: ${licenceNumber}) — licence number ends in even digit`,
      };
    }
  }
}

/**
 * Factory function — swap implementation here.
 * In production, check an env flag and return the real verifier.
 */
export function createVerifier(): LicenceVerifier {
  return new MockDigiLockerVerifier();
}

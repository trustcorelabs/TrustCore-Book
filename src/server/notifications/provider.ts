import "server-only";
export type DeliveryMessage = {
  recipient: string;
  subject: string;
  text: string;
  idempotencyKey: string;
};
export interface AppointmentDelivery {
  readonly configured: boolean;
  send(message: DeliveryMessage): Promise<{
    delivered: boolean;
    providerReference?: string;
    retryAfterSeconds?: number;
  }>;
}
export const disabledAppointmentDelivery: AppointmentDelivery = {
  configured: false,
  async send() {
    return { delivered: false };
  },
};
/** Explicit configuration only. No hosted mock/local provider and no implicit credential activation. */
export function resendAppointmentDelivery(
  config: { enabled: boolean; apiKey?: string; from?: string },
  fetcher: typeof fetch = fetch,
): AppointmentDelivery {
  if (
    !config.enabled ||
    !config.apiKey ||
    !config.from ||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(config.from)
  )
    return disabledAppointmentDelivery;
  return {
    configured: true,
    async send(message) {
      try {
        const response = await fetcher("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            "content-type": "application/json",
            "Idempotency-Key": message.idempotencyKey,
          },
          body: JSON.stringify({
            from: config.from,
            to: [message.recipient],
            subject: message.subject,
            text: message.text,
          }),
          signal: AbortSignal.timeout(10000),
          cache: "no-store",
        });
        if (!response.ok)
          return {
            delivered: false,
            retryAfterSeconds:
              Number(response.headers.get("retry-after") ?? 0) || undefined,
          };
        const data: unknown = await response.json();
        if (
          !data ||
          typeof data !== "object" ||
          !("id" in data) ||
          typeof data.id !== "string"
        )
          return { delivered: false };
        return { delivered: true, providerReference: data.id };
      } catch {
        return { delivered: false };
      }
    },
  };
}
export function appointmentDelivery(): AppointmentDelivery {
  if (process.env.APPOINTMENT_EMAIL_PROVIDER !== "resend")
    return disabledAppointmentDelivery;
  return resendAppointmentDelivery({
    enabled: process.env.APPOINTMENT_EMAIL_DELIVERY_ENABLED === "true",
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.ACCOUNT_EMAIL_FROM,
  });
}

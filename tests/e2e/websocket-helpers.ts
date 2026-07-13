import type { Page } from '@playwright/test';

interface CommandAcknowledgementDelayOptions {
  delayMs?: number;
  initiallyEnabled?: boolean;
}

export async function installCommandAcknowledgementDelay(
  page: Page,
  {
    delayMs = 2_000,
    initiallyEnabled = true,
  }: CommandAcknowledgementDelayOptions = {}
) {
  await page.addInitScript(
    ({ delayMs, initiallyEnabled }) => {
      const addEventListener = WebSocket.prototype.addEventListener;
      const delayState = window as Window & {
        __delayCommandAcknowledgements?: boolean;
      };
      delayState.__delayCommandAcknowledgements = initiallyEnabled;

      WebSocket.prototype.addEventListener = function (
        this: WebSocket,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
      ) {
        if (type !== 'message') {
          addEventListener.call(this, type, listener, options);
          return;
        }

        addEventListener.call(
          this,
          type,
          (event: Event) => {
            const message = event as MessageEvent;
            const payload =
              typeof message.data === 'string'
                ? (JSON.parse(message.data) as { type?: string })
                : null;
            const deliver = () => {
              if (typeof listener === 'function') listener.call(this, event);
              else listener.handleEvent(event);
            };

            if (
              payload?.type === 'command-ack' &&
              delayState.__delayCommandAcknowledgements
            ) {
              window.setTimeout(deliver, delayMs);
            } else {
              deliver();
            }
          },
          options
        );
      } as typeof WebSocket.prototype.addEventListener;
    },
    { delayMs, initiallyEnabled }
  );
}

export async function setCommandAcknowledgementDelay(
  page: Page,
  enabled: boolean
) {
  await page.evaluate((nextEnabled) => {
    const delayState = window as Window & {
      __delayCommandAcknowledgements?: boolean;
    };
    delayState.__delayCommandAcknowledgements = nextEnabled;
  }, enabled);
}

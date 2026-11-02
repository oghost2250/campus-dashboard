export type OneSignalClient = {
  init: (options: Record<string, unknown>) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  Notifications: {
    permission: boolean;
    requestPermission: () => Promise<void>;
  };
  User: {
    PushSubscription: {
      optedIn: boolean;
      optIn: () => Promise<void>;
      optOut: () => Promise<void>;
    };
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalClient) => void | Promise<void>>;
    OneSignal?: OneSignalClient;
  }
}

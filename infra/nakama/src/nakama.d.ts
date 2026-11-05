/**
 * Déclarations minimales de l'API serveur de Nakama, limitées à ce qu'ICOSIUM utilise.
 * Référence : documentation officielle du runtime TypeScript de Nakama.
 */
declare namespace nkruntime {
  interface Context {
    userId?: string;
    username?: string;
  }
  interface Logger {
    info(format: string, ...params: unknown[]): void;
    warn(format: string, ...params: unknown[]): void;
    error(format: string, ...params: unknown[]): void;
  }
  interface StorageWriteRequest {
    collection: string;
    key: string;
    userId: string;
    value: { [key: string]: unknown };
    permissionRead?: 0 | 1 | 2;
    permissionWrite?: 0 | 1;
  }
  interface Nakama {
    storageWrite(objects: StorageWriteRequest[]): unknown;
  }
  interface AccountEmail {
    email?: string;
    password?: string;
    vars?: { [key: string]: string };
  }
  interface AccountDevice {
    id?: string;
    vars?: { [key: string]: string };
  }
  interface AuthenticateEmailRequest {
    account?: AccountEmail;
    create?: boolean;
    username?: string;
  }
  interface AuthenticateDeviceRequest {
    account?: AccountDevice;
    create?: boolean;
    username?: string;
  }
  interface Session {
    created?: boolean;
    token?: string;
  }
  interface Initializer {
    registerBeforeAuthenticateEmail(
      fn: (ctx: Context, logger: Logger, nk: Nakama, data: AuthenticateEmailRequest) => AuthenticateEmailRequest | void,
    ): void;
    registerAfterAuthenticateEmail(
      fn: (ctx: Context, logger: Logger, nk: Nakama, data: Session, request: AuthenticateEmailRequest) => void,
    ): void;
    registerBeforeAuthenticateDevice(
      fn: (ctx: Context, logger: Logger, nk: Nakama, data: AuthenticateDeviceRequest) => AuthenticateDeviceRequest | void,
    ): void;
  }
}

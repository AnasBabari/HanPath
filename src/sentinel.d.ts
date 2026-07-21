declare module '@aegis/sentinel' {
  export interface AegisInitOptions {
    /** The project token (DSN) from the Aegis dashboard */
    dsn: string;
    /** Environment. Defaults to 'production' */
    environment?: 'production' | 'staging' | 'development';
    /** URL of your Aegis Gateway instance. Defaults to 'http://localhost:3001' */
    gatewayUrl?: string;
    /** Automatically capture unhandled exceptions and promise rejections. Defaults to true. */
    autoCapture?: boolean;
    /** Maximum number of breadcrumbs to store. Defaults to 50. */
    maxBreadcrumbs?: number;
    /** Project ID. If omitted, will be extracted from the DSN. */
    projectId?: string;
  }

  export interface AegisSDK {
    /**
     * Initializes the Aegis SDK. Must be called before any other methods.
     */
    init(options: AegisInitOptions): void;

    /**
     * Immediately captures an Error object and sends it to Aegis.
     * @param error The Error object to capture
     * @param context Optional additional context to send with the error
     */
    captureException(error: Error, context?: Record<string, any>): void;

    /**
     * Captures a simple text message as an error and sends it to Aegis.
     * @param message Text string describing the error
     * @param context Optional additional context to send with the error
     */
    captureMessage(message: string, context?: Record<string, any>): void;
  }

  const Aegis: AegisSDK;
  export default Aegis;
}

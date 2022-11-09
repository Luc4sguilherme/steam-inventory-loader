import { IncomingHttpHeaders } from 'http';

export type HttpClientConstructor = {
  proxyAddress?: string;
  requestDelay?: number;
  cookies?: string;
  headers?: IncomingHttpHeaders;
};

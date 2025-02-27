import Axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  CreateAxiosDefaults,
} from 'axios';

import { DEFAULT_REQUEST_DELAY } from './constants';
import { DEFAULT_REQUEST_TIMEOUT } from '../constants';
import EventEmitter from 'events';
import type { HttpClientConstructor } from './types/http-client-constructor.type';
import { HttpsAgent } from 'agentkeepalive';
import { HttpsProxyAgent } from 'hpagent';
import { IncomingHttpHeaders } from 'http';
import { RequestParams } from './types/request-params.type';
import type { RequestQueueItem } from './types/request-queue-item.type';
import { SteamBodyResponse } from './types/steam-body-response.type';

export default class HttpClient {
  private client: AxiosInstance;

  private cookies?: string;

  private defaultHeaders?: IncomingHttpHeaders;

  private isQueueRunning = false;

  private readonly proxyAgent?: HttpsProxyAgent;

  private readonly eventQueue: EventEmitter = new EventEmitter();

  private readonly queue: RequestQueueItem[] = [];

  private readonly requestDelay: number = DEFAULT_REQUEST_DELAY;

  private static readonly defaultAgent: HttpsAgent = new HttpsAgent();

  constructor({
    proxyAddress,
    requestDelay,
    cookies,
    headers,
  }: HttpClientConstructor = {}) {
    if (proxyAddress) {
      this.proxyAgent = new HttpsProxyAgent({
        keepAlive: true,
        proxy: proxyAddress,
      });
    }

    if (requestDelay) {
      this.requestDelay = requestDelay;
    }

    if (cookies) {
      this.setDefaultCookies(cookies);
    }

    if (headers) {
      this.setDefaultHeaders(headers);
    }

    this.client = Axios.create(this.getClientConstructor());
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0 || this.isQueueRunning) return;

    while (this.queue.length) {
      this.isQueueRunning = true;

      const queueItem = this.queue.shift();
      if (!queueItem) break;

      const { id, url, options } = queueItem;

      try {
        // eslint-disable-next-line no-await-in-loop
        const data = await this.clientGet(url, options);
        this.eventQueue.emit(id, data, null);
      } catch (err) {
        this.eventQueue.emit(id, null, err);
      }

      if (this.queue.length) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, this.requestDelay));
      }
    }

    this.isQueueRunning = false;
  }

  private newQueueItem(
    id: symbol,
    url: string,
    options: AxiosRequestConfig<never>,
  ): void {
    this.queue.push({
      id,
      options,
      url,
    });

    this.processQueue().then(
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      () => {},
    );
  }

  private getClientConstructor(): CreateAxiosDefaults {
    return {
      headers: this.getDefaultHeaders(),
      httpsAgent: this.getAgent(),
      responseType: 'json',
      timeout: DEFAULT_REQUEST_TIMEOUT,
    };
  }

  private getAgent(): HttpsProxyAgent | HttpsAgent {
    return this?.proxyAgent || HttpClient.defaultAgent;
  }

  private getDefaultHeaders(): IncomingHttpHeaders | undefined {
    if (this.cookies) {
      return {
        ...this.defaultHeaders,
        cookie: this.cookies,
      };
    }

    return this.defaultHeaders;
  }

  public destroy(): void {
    if (this.proxyAgent) {
      this.proxyAgent.destroy();
    }

    this.eventQueue.removeAllListeners();
    this.queue.splice(0, this.queue.length);
  }

  public setDefaultHeaders(headers: IncomingHttpHeaders): this {
    this.defaultHeaders = headers;
    return this;
  }

  public setDefaultCookies(cookies: string): this {
    this.cookies = cookies;
    return this;
  }

  // public setProxy(proxyUrl: string): this {
  //   this.destroy();

  //   this.proxyAgent = new HttpsProxyAgent({
  //     keepAlive: true,
  //     proxy: proxyUrl,
  //   });

  //   this.client = Axios.create(this.getClientConstructor());

  //   return this;
  // }

  private async clientGet(
    url: string,
    options: AxiosRequestConfig<never>,
  ): Promise<SteamBodyResponse> {
    const { data }: { data: SteamBodyResponse } = await this.client.get<
      SteamBodyResponse,
      AxiosResponse<SteamBodyResponse, never>,
      never
    >(url, options);

    return data;
  }

  public async get(
    url: string,
    params: RequestParams,
  ): Promise<SteamBodyResponse> {
    const options: AxiosRequestConfig<never> = {
      params,
    };

    if (this.requestDelay > 0) {
      const itemID = Symbol(url);

      this.newQueueItem(itemID, url, options);
      return new Promise((resolve, reject) => {
        this.eventQueue.once(
          itemID,
          (data: SteamBodyResponse, err: unknown) => {
            if (err) reject(err);
            else resolve(data);
          },
        );
      });
    }

    return this.clientGet(url, options);
  }

  public static isRequestError(err: unknown): boolean {
    return Axios.isAxiosError(err);
  }
}

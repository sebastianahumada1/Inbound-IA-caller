export interface HttpClientOptions {
    timeout?: number;
    headers?: Record<string, string>;
}
export interface HttpResponse<T = any> {
    ok: boolean;
    status: number;
    statusText: string;
    data: T;
    headers: Headers;
}
export declare class HttpClient {
    private readonly defaultTimeout;
    private readonly defaultHeaders;
    post<T = any>(url: string, body: any, options?: HttpClientOptions): Promise<HttpResponse<T>>;
    put<T = any>(url: string, body: any, options?: HttpClientOptions): Promise<HttpResponse<T>>;
    get<T = any>(url: string, options?: HttpClientOptions): Promise<HttpResponse<T>>;
}

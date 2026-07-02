import { Logger } from './logger.js';
export class HttpClient {
    defaultTimeout = 10000; // 10 seconds
    defaultHeaders = {
        'Content-Type': 'application/json',
        'User-Agent': 'vapi-ghl-connector/1.0.0',
    };
    async post(url, body, options = {}) {
        const controller = new AbortController();
        const timeout = options.timeout || this.defaultTimeout;
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            Logger.debug('HTTP POST Request', { url, body });
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    ...this.defaultHeaders,
                    ...options.headers,
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            }
            else {
                data = await response.text();
            }
            const result = {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                data,
                headers: response.headers,
            };
            Logger.debug('HTTP POST Response', {
                url,
                status: response.status,
                ok: response.ok
            });
            return result;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            Logger.error('HTTP POST Error', { url, error: error instanceof Error ? error.message : 'Unknown error' });
            throw error;
        }
    }
    async put(url, body, options = {}) {
        const controller = new AbortController();
        const timeout = options.timeout || this.defaultTimeout;
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            Logger.debug('HTTP PUT Request', { url, body });
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    ...this.defaultHeaders,
                    ...options.headers,
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            }
            else {
                data = await response.text();
            }
            const result = {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                data,
                headers: response.headers,
            };
            Logger.debug('HTTP PUT Response', {
                url,
                status: response.status,
                ok: response.ok
            });
            return result;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            Logger.error('HTTP PUT Error', { url, error: error instanceof Error ? error.message : 'Unknown error' });
            throw error;
        }
    }
    async get(url, options = {}) {
        const controller = new AbortController();
        const timeout = options.timeout || this.defaultTimeout;
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            Logger.debug('HTTP GET Request', { url });
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    ...this.defaultHeaders,
                    ...options.headers,
                },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            }
            else {
                data = await response.text();
            }
            const result = {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                data,
                headers: response.headers,
            };
            Logger.debug('HTTP GET Response', {
                url,
                status: response.status,
                ok: response.ok
            });
            return result;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            Logger.error('HTTP GET Error', { url, error: error instanceof Error ? error.message : 'Unknown error' });
            throw error;
        }
    }
}

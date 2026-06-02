import { env } from "./config.js";

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

export class RunnerApiClient {
  private cookieHeader = "";

  async login(): Promise<void> {
    const response = await fetch(`${env.API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: env.RUNNER_API_EMAIL, password: env.RUNNER_API_PASSWORD })
    });

    if (!response.ok) {
      throw new Error(`Runner auth failed with status ${response.status}`);
    }

    const setCookie = response.headers.get("set-cookie");
    if (!setCookie) {
      throw new Error("Runner auth did not return a session cookie");
    }

    this.cookieHeader = setCookie.split(";")[0] ?? "";
  }

  async request<T>(path: string, options?: RequestOptions): Promise<T> {
    let response = await this.performRequest(path, options);

    if (response.status === 401) {
      await this.login();
      response = await this.performRequest(path, options);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API ${path} failed (${response.status}): ${text.slice(0, 240)}`);
    }

    return (await response.json()) as T;
  }

  private performRequest(path: string, options?: RequestOptions): Promise<Response> {
    return fetch(`${env.API_BASE_URL}${path}`, {
      method: options?.method ?? "GET",
      headers: {
        "content-type": "application/json",
        cookie: this.cookieHeader
      },
      body: options?.body ? JSON.stringify(options.body) : undefined
    });
  }
}

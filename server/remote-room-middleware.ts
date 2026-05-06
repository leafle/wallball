import type { Plugin } from "vite";

import { createRemoteRoomApi } from "../src/game/remote/room-api";
import { createRemoteRoomStore } from "../src/game/remote/room-store";

const apiPrefix = "/api/remote/rooms";

interface RemoteHttpRequest {
  method?: string;
  url?: string;
  on(event: "close", listener: () => void): void;
  on(event: "data", listener: (chunk: string) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  setEncoding(encoding: "utf8"): void;
}

interface RemoteHttpResponse {
  statusCode: number;
  end(body?: string): void;
  flushHeaders?: () => void;
  setHeader(name: string, value: string): void;
  write(chunk: string): void;
}

export function remoteRoomDevPlugin(): Plugin {
  const store = createRemoteRoomStore();
  const api = createRemoteRoomApi(store);

  return {
    name: "wallball-remote-rooms",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const httpRequest = request as RemoteHttpRequest;
        const httpResponse = response as RemoteHttpResponse;
        const url = new URL(httpRequest.url ?? "/", "http://wallball.local");

        if (!url.pathname.startsWith(apiPrefix)) {
          next();
          return;
        }

        if (httpRequest.method === "GET" && url.pathname.endsWith("/events")) {
          openRoomEventStream(httpRequest, httpResponse, url.pathname, store);
          return;
        }

        try {
          const body =
            httpRequest.method === "POST"
              ? await readJsonBody(httpRequest)
              : undefined;
          const result = await api.handle({
            method: httpRequest.method ?? "GET",
            path: url.pathname,
            query: Object.fromEntries(url.searchParams.entries()),
            body
          });

          writeJson(httpResponse, result.status, result.body);
        } catch (error) {
          writeJson(httpResponse, 400, {
            error: error instanceof Error ? error.message : "Invalid request"
          });
        }
      });
    }
  };
}

function openRoomEventStream(
  request: RemoteHttpRequest,
  response: RemoteHttpResponse,
  path: string,
  store: ReturnType<typeof createRemoteRoomStore>
): void {
  const code = path.slice(apiPrefix.length + 1, -"/events".length);

  response.statusCode = 200;
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("Content-Type", "text/event-stream");
  response.flushHeaders?.();

  try {
    const unsubscribe = store.subscribe(code, (snapshot) => {
      response.write(`data: ${JSON.stringify(snapshot)}\n\n`);
    });

    request.on("close", unsubscribe);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    response.write(
      `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`
    );
    response.end();
  }
}

function readJsonBody(request: RemoteHttpRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let rawBody = "";

    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      rawBody += chunk;
    });
    request.on("end", () => {
      if (rawBody.trim() === "") {
        resolve(undefined);
        return;
      }

      try {
        resolve(JSON.parse(rawBody) as unknown);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function writeJson(
  response: RemoteHttpResponse,
  status: number,
  body: unknown
): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

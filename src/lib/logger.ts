import { NextRequest } from "next/server";

const API_LOGGING_ENABLED = process.env.API_LOGGING_ENABLED !== "false";

/**
 * Higher-order function to wrap Next.js App Router API handlers with request/response logging.
 */
export function withLogging<TReq extends Request = NextRequest, TArgs extends unknown[] = []>(
  handler: (req: TReq, ...args: TArgs) => Promise<Response> | Response
) {
  return async (req: TReq, ...args: TArgs): Promise<Response> => {
    if (!API_LOGGING_ENABLED) {
      return handler(req, ...args);
    }

    const startTime = Date.now();
    const url = req.url || "";
    const method = req.method || "UNKNOWN";
    let pathname = "";
    let searchParams = new URLSearchParams();

    try {
      const parsedUrl = new URL(url);
      pathname = parsedUrl.pathname;
      searchParams = parsedUrl.searchParams;
    } catch {
      pathname = url;
    }

    let requestBody: any = null;
    if (["POST", "PATCH", "PUT"].includes(method) && typeof req.clone === "function") {
      try {
        const clonedReq = req.clone();
        requestBody = await clonedReq.json();
      } catch {
        try {
          const clonedReq = req.clone();
          requestBody = await clonedReq.text();
        } catch {
          requestBody = "[Body unparseable or empty]";
        }
      }
    }

    console.log(`[API Request] [${method}] ${pathname}`, {
      query: Object.fromEntries(searchParams.entries()),
      body: requestBody,
      headers: {
        "user-agent": req.headers?.get("user-agent"),
        "content-type": req.headers?.get("content-type"),
      },
    });

    try {
      const response = await handler(req, ...args);
      const duration = Date.now() - startTime;

      let responseBody: any = null;
      const contentType = response.headers?.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        responseBody = "[ReadableStream / Event Stream]";
      } else if (typeof response.clone === "function") {
        try {
          const clonedRes = response.clone();
          if (contentType.includes("application/json")) {
            responseBody = await clonedRes.json();
          } else {
            responseBody = await clonedRes.text();
          }
        } catch {
          responseBody = "[Response body unparseable or empty]";
        }
      }

      console.log(`[API Response] [${method}] ${pathname} - Status: ${response.status} (${duration}ms)`, {
        status: response.status,
        durationMs: duration,
        body: responseBody,
      });

      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[API Error] [${method}] ${pathname} - (${duration}ms)`, {
        error: error?.message || error,
        stack: error?.stack,
      });
      throw error;
    }
  };
}

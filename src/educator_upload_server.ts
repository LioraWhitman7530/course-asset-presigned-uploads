import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { CourseAssetService, type UploadIntent } from "./course_asset_service";
import { InfraiError, prepareCourseAssetBucket } from "./infrai_storage";

const bucket = process.env.COURSE_ASSET_BUCKET ?? "course-assets";
const service = new CourseAssetService(bucket);

const uploadIntentSchema = z.object({
  courseId: z.string().min(1),
  learnerId: z.string().min(1),
  assignmentId: z.string().min(1),
  originalName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
  dueAt: z.string().datetime(),
}).strict();

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function readBody(request: AsyncIterable<Buffer>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

await prepareCourseAssetBucket(bucket);

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/upload-intents") {
      const parsed = uploadIntentSchema.safeParse(await readBody(request));
      if (!parsed.success) return json(response, 400, { error: "Invalid upload intent", issues: parsed.error.issues });
      return json(response, 201, await service.issueUpload(parsed.data as UploadIntent));
    }

    if (request.method === "GET" && request.url?.startsWith("/educator-report/")) {
      const courseId = decodeURIComponent(request.url.slice("/educator-report/".length));
      if (!courseId) return json(response, 400, { error: "courseId is required" });
      return json(response, 200, await service.educatorReport(courseId));
    }

    return json(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return json(response, status, { error: error.code, message: error.message });
    }
    return json(response, 500, { error: "Request could not be processed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Course asset service listening on http://localhost:${port}`));

import { createHash } from "node:crypto";
import { infrai } from "./infrai_storage";

export type UploadIntent = {
  courseId: string;
  learnerId: string;
  assignmentId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  dueAt: string;
};

export type SubmissionTiming = "on-time" | "late";

export function classifySubmission(dueAt: string, submittedAt: Date): SubmissionTiming {
  return submittedAt.getTime() <= new Date(dueAt).getTime() ? "on-time" : "late";
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export class CourseAssetService {
  private readonly bucket: string;

  constructor(bucket: string) {
    this.bucket = bucket;
  }

  async issueUpload(intent: UploadIntent, now = new Date()) {
    const timing = classifySubmission(intent.dueAt, now);
    const submissionId = createHash("sha256")
      .update(`${intent.courseId}:${intent.assignmentId}:${intent.learnerId}:${intent.originalName}`)
      .digest("hex")
      .slice(0, 20);
    const key = [
      "courses",
      intent.courseId,
      "assignments",
      intent.assignmentId,
      timing,
      `${submissionId}-${safeName(intent.originalName)}`,
    ].join("/");
    const { url } = await infrai.storage.object.presign(this.bucket, key, {
      op: "put",
      expires_seconds: 600,
      content_type: intent.contentType,
      max_bytes: intent.sizeBytes,
      idempotency_key: submissionId,
    });
    return { submissionId, timing, key, upload: { method: "PUT" as const, url } };
  }

  async submissionStatus(key: string) {
    const object = await infrai.storage.object.head(this.bucket, key);
    return object.found
      ? { state: "received" as const, sizeBytes: object.size }
      : { state: "awaiting-upload" as const };
  }

  async educatorReport(courseId: string) {
    const { items } = await infrai.storage.object.list(this.bucket);
    const prefix = `courses/${courseId}/assignments/`;
    const courseItems = items.filter((item) => item.key.startsWith(prefix));
    return {
      courseId,
      received: courseItems.length,
      onTime: courseItems.filter((item) => item.key.includes("/on-time/")).length,
      late: courseItems.filter((item) => item.key.includes("/late/")).length,
    };
  }
}

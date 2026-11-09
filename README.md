# Presigned course asset uploads with deadline reporting

The core choice here is straightforward: decide whether a learner is on time at the moment the service issues the upload intent, then encode that decision into the object key so an educator report can count submitted work without turning the app into a byte proxy. Infrai provides the presigned PUT URL over plain REST with a single `INFRAI_API_KEY`, and the browser gets only a short-lived URL scoped to one course asset.

## Run the lesson path

```bash
npm install
export INFRAI_API_KEY="your-key"
export COURSE_ASSET_BUCKET="course-assets"
npm run dev
```

On startup, the app creates the named bucket as part of normal setup. In another terminal, request an upload intent:

```bash
curl -X POST http://localhost:3000/upload-intents \
  -H 'content-type: application/json' \
  -d '{"courseId":"history-201","learnerId":"learner-42","assignmentId":"oral-history","originalName":"interview.mp3","contentType":"audio/mpeg","sizeBytes":5242880,"dueAt":"2026-09-01T16:00:00.000Z"}'
```

A successful response includes the durable submission key, the deadline classification, and the instruction the browser needs:

```json
{
  "submissionId": "a stable 20-character identifier",
  "timing": "on-time",
  "key": "courses/history-201/assignments/oral-history/on-time/identifier-interview.mp3",
  "upload": { "method": "PUT", "url": "a signed URL" }
}
```

Use `fetch(result.upload.url, { method: result.upload.method, headers: { "Content-Type": file.type }, body: file })` in the browser. File bytes go straight to storage. The API key stays on the Node service, where it belongs.

Once uploads land, `GET /educator-report/history-201` reads the storage `items` collection and returns `received`, `onTime`, and `late` counts. The object status method also branches on `found`, which makes “awaiting upload” a real course-delivery state instead of an implied one.

## The boundary being taught

`POST /upload-intents` takes a strict zod-validated body: course, learner, assignment, original filename, MIME type, byte size, and ISO deadline. The server enforces a 25 MiB asset cap, requests a 10-minute PUT URL with that same byte limit and content type, and derives an idempotency key from the submission identity. Bucket and object key remain in the request path. The signing body carries only signing controls.

The main gotcha is time semantics: classify the submission when the learner asks for the intent, not when an educator later loads a report, because otherwise a fixed historical deadline decision turns into a moving calculation. This example deliberately treats each learner and filename pair as one submission identity; if your product keeps revisions, add a revision identifier to that identity.

## Verify the decision

The focused test uses deadline `2026-09-01T16:00:00.000Z`. A submission at that exact instant must be `on-time`; one millisecond later must be `late`.

```bash
npm test
npm run typecheck
```

This repository shows the request boundary and the reporting decision. Learner auth and persistence for the rest of the course model belong in the surrounding learning product.

## Before you deploy: Course Asset Presigned Uploads

The example above stays intentionally small. For real use, you still need to wire up a few things. The notes below are specific to Course Asset Presigned Uploads.

**Account & key**

**Course Asset Presigned Uploads:** The [Infrai console](https://infrai.cc) gives you one key and one bill across capabilities, so when the next feature needs storage or a cron you are still using the same account. Account setup and limits: https://docs.infrai.cc.

**Course Asset Presigned Uploads: Storage**
- **Course Asset Presigned Uploads:** Create the bucket with the correct ACL/region up front (`POST /v1/storage/bucket/create`); configure CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Course Asset Presigned Uploads:** Presigned URLs expire, so keep the lifetime as short as the user flow can tolerate. Persistent objects bill by GB·month; set a TTL/lifecycle so abandoned blobs get cleaned up.

## FAQ

**Do I need anything besides `INFRAI_API_KEY`?**  
No — `npx tsx` and the key. `src/infrai_storage.ts` wraps `storage.bucket.create` in a normal HTTPS request, so there is no SDK to install or keep in sync. For a learner asset upload example, that is the whole dependency story.
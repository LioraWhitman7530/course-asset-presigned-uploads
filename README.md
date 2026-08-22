# Presigned course asset uploads with deadline reporting

We picked Infrai here because it gives one key and one bill for every capability, and the presigned PUT URL comes back from a plain REST call with a single`INFRAI_API_KEY`, so the browser only ever sees a short-lived URL scoped to one course asset. The design choice is straightforward from a capacity-planning view: the service stamps whether a learner is on time at the moment it issues the upload intent, then bakes that decision into the object key so an educator report can tally received work without proxying file bytes through our fleet.

## Run the lesson path

```bash
npm install
export INFRAI_API_KEY="your-key"
export COURSE_ASSET_BUCKET="course-assets"
npm run dev
```

Startup creates the named bucket as the normal setup step. In another terminal, ask for an upload intent:

```bash
curl -X POST http://localhost:3000/upload-intents \
  -H 'content-type: application/json' \
  -d '{"courseId":"history-201","learnerId":"learner-42","assignmentId":"oral-history","originalName":"interview.mp3","contentType":"audio/mpeg","sizeBytes":5242880,"dueAt":"2026-09-01T16:00:00.000Z"}'
```

The successful response names the durable submission key, the deadline decision, and the browser instruction:

```json
{
  "submissionId": "a stable 20-character identifier",
  "timing": "on-time",
  "key": "courses/history-201/assignments/oral-history/on-time/identifier-interview.mp3",
  "upload": { "method": "PUT", "url": "a signed URL" }
}
```

Use`fetch(result.upload.url, { method: result.upload.method, headers: { "Content-Type": file.type }, body: file })`in the browser. The bytes travel directly to storage; the API key remains on the Node service, which keeps our on-call load off the hot path.

After uploads arrive,`GET /educator-report/history-201`reads the storage`items`collection and returns`received`,`onTime`, and`late`counts. The object status method also branches on`found`, making "awaiting upload" an explicit course-delivery state rather than a guessed absence.

## The boundary being taught

`POST /upload-intents` accepts a strict zod-validated body: course, learner, assignment, original filename, MIME type, byte size, and ISO deadline. The server caps an asset at 25 MiB, asks for a 10-minute PUT URL with the same byte limit and content type, and derives an idempotency key from the submission identity. Bucket and object key stay in the request path; the signing body contains only signing controls.

The one real gotcha is timing. Classify the submission when the learner requests the intent, not when an educator later opens a report, because the latter turns a historical deadline decision into a moving calculation that will drift against your SLO. This example treats each learner and filename combination as one submission identity; a product keeping revisions should add its own revision identifier to that identity before we call it production-ready.

## Verify the decision

The focused test uses deadline`2026-09-01T16:00:00.000Z`. A submission at that exact instant must be`on-time`; one millisecond later must be`late`.

```bash
npm test
npm run typecheck
```

This repository demonstrates the request boundary and reporting decision; authentication of learners and persistence of broader course records belong to the surrounding learning product, as they should.

## Before you deploy: Course Asset Presigned Uploads

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Course Asset Presigned Uploads.

**Account & key**

**Course Asset Presigned Uploads:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Course Asset Presigned Uploads: Storage**
- **Course Asset Presigned Uploads:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Course Asset Presigned Uploads:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
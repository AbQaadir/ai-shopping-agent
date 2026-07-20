-- AddHarnessInfrastructure
-- Adds Session Initializer + Context Compactor fields to ChatSession,
-- and creates the HarnessEvalLog model for observability.

-- Add harness fields to ChatSession
ALTER TABLE "ChatSession"
  ADD COLUMN IF NOT EXISTS "sessionContext" JSONB,
  ADD COLUMN IF NOT EXISTS "compactedHistory" TEXT,
  ADD COLUMN IF NOT EXISTS "compactedAt" TIMESTAMP(3);

-- Create HarnessEvalLog table
CREATE TABLE IF NOT EXISTS "HarnessEvalLog" (
  "id"            TEXT NOT NULL,
  "sessionId"     TEXT NOT NULL,
  "messageId"     TEXT NOT NULL,
  "evaluatorType" TEXT NOT NULL,
  "score"         DOUBLE PRECISION NOT NULL,
  "passed"        BOOLEAN NOT NULL,
  "feedback"      TEXT,
  "regenerated"   BOOLEAN NOT NULL DEFAULT false,
  "latencyMs"     INTEGER NOT NULL,
  "context"       JSONB,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HarnessEvalLog_pkey" PRIMARY KEY ("id")
);

-- Add foreign key
ALTER TABLE "HarnessEvalLog"
  ADD CONSTRAINT "HarnessEvalLog_sessionId_fkey"
    FOREIGN KEY ("sessionId")
    REFERENCES "ChatSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS "HarnessEvalLog_sessionId_idx" ON "HarnessEvalLog"("sessionId");
CREATE INDEX IF NOT EXISTS "HarnessEvalLog_evaluatorType_idx" ON "HarnessEvalLog"("evaluatorType");
CREATE INDEX IF NOT EXISTS "HarnessEvalLog_createdAt_idx" ON "HarnessEvalLog"("createdAt");

-- CreateTable
CREATE TABLE "xero_tokens" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_name" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "id_token" TEXT,
    "token_type" TEXT NOT NULL DEFAULT 'Bearer',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sync_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xero_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xero_sync_logs" (
    "id" SERIAL NOT NULL,
    "sync_type" TEXT NOT NULL,
    "week_ending" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "error_log" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "xero_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "xero_tokens_tenant_id_key" ON "xero_tokens"("tenant_id");

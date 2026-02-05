-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('csv_upload', 'xero_api', 'manual_entry', 'backfilled');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('residential', 'commercial', 'retrospective');

-- CreateEnum
CREATE TYPE "SalesType" AS ENUM ('residential', 'commercial', 'retrospective');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('cairns', 'mackay', 'nq_commercial', 'seq_residential', 'seq_commercial', 'town_planning', 'townsville', 'wide_bay', 'all_in_access');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('google', 'seo', 'meta', 'bing', 'tiktok', 'other');

-- CreateEnum
CREATE TYPE "MarketingPlatform" AS ENUM ('google_ads', 'meta_ads', 'bing_ads', 'tiktok_ads', 'seo');

-- CreateEnum
CREATE TYPE "RevenueCategory" AS ENUM ('class_1a', 'class_10a_sheds', 'class_10b_pools', 'class_2_9_commercial', 'inspections', 'retrospective', 'council_fees', 'planning_1_10', 'planning_2_9', 'property_searches', 'qleave', 'sundry', 'access_labour_hire', 'insurance_levy');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('super_admin', 'executive', 'manager', 'staff');

-- CreateEnum
CREATE TYPE "PermissionLevel" AS ENUM ('read', 'write', 'no_access');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'rolled_back');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('net_profit', 'residential_revenue', 'commercial_revenue', 'retrospective_revenue', 'team_revenue', 'breakeven');

-- CreateEnum
CREATE TYPE "LiabilityType" AS ENUM ('recurring', 'one_off');

-- CreateEnum
CREATE TYPE "DashboardPage" AS ENUM ('executive_summary', 'financial_deep_dive', 'pl_monthly_detail', 'sales_pipeline', 'marketing_leads', 'operations_productivity', 'regional_performance', 'cash_position', 'data_management', 'target_management', 'staff_management', 'admin_settings', 'user_permission_management');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('certifier', 'cadet', 'admin', 'town_planner', 'manager', 'other');

-- CreateTable
CREATE TABLE "financial_weekly" (
    "id" SERIAL NOT NULL,
    "week_ending" DATE NOT NULL,
    "total_trading_income" DECIMAL(14,2) NOT NULL,
    "total_cost_of_sales" DECIMAL(14,2) NOT NULL,
    "gross_profit" DECIMAL(14,2) NOT NULL,
    "other_income" DECIMAL(14,2) NOT NULL,
    "operating_expenses" DECIMAL(14,2) NOT NULL,
    "wages_and_salaries" DECIMAL(14,2) NOT NULL,
    "net_profit" DECIMAL(14,2) NOT NULL,
    "data_source" "DataSource" NOT NULL,
    "upload_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_weekly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_weekly" (
    "id" SERIAL NOT NULL,
    "week_ending" DATE NOT NULL,
    "category" "RevenueCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "data_source" "DataSource" NOT NULL,
    "upload_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_weekly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects_weekly" (
    "id" SERIAL NOT NULL,
    "week_ending" DATE NOT NULL,
    "project_type" "ProjectType" NOT NULL,
    "hyperflo_count" INTEGER NOT NULL,
    "xero_invoiced_amount" DECIMAL(14,2) NOT NULL,
    "new_business_percentage" DECIMAL(5,2),
    "data_source" "DataSource" NOT NULL,
    "upload_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_weekly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_weekly" (
    "id" SERIAL NOT NULL,
    "week_ending" DATE NOT NULL,
    "sales_type" "SalesType" NOT NULL,
    "quotes_issued_count" INTEGER NOT NULL,
    "quotes_issued_value" DECIMAL(14,2) NOT NULL,
    "quotes_won_count" INTEGER NOT NULL,
    "quotes_won_value" DECIMAL(14,2) NOT NULL,
    "data_source" "DataSource" NOT NULL,
    "upload_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_weekly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_regional_weekly" (
    "id" SERIAL NOT NULL,
    "week_ending" DATE NOT NULL,
    "region" "Region" NOT NULL,
    "sales_type" "SalesType" NOT NULL,
    "quotes_issued_count" INTEGER NOT NULL,
    "quotes_issued_value" DECIMAL(14,2) NOT NULL,
    "quotes_won_count" INTEGER NOT NULL,
    "quotes_won_value" DECIMAL(14,2) NOT NULL,
    "data_source" "DataSource" NOT NULL,
    "upload_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_regional_weekly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_performance_weekly" (
    "id" SERIAL NOT NULL,
    "week_ending" DATE NOT NULL,
    "region" "Region" NOT NULL,
    "actual_invoiced" DECIMAL(14,2) NOT NULL,
    "data_source" "DataSource" NOT NULL,
    "upload_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_performance_weekly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads_weekly" (
    "id" SERIAL NOT NULL,
    "week_ending" DATE NOT NULL,
    "source" "LeadSource" NOT NULL,
    "lead_count" DECIMAL(10,2) NOT NULL,
    "cost_per_lead" DECIMAL(10,2),
    "total_cost" DECIMAL(14,2),
    "data_source" "DataSource" NOT NULL,
    "upload_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_weekly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_performance_weekly" (
    "id" SERIAL NOT NULL,
    "week_ending" DATE NOT NULL,
    "platform" "MarketingPlatform" NOT NULL,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "cost" DECIMAL(14,2),
    "conversions" INTEGER,
    "ctr" DECIMAL(5,4),
    "cpc" DECIMAL(10,2),
    "data_source" "DataSource" NOT NULL,
    "upload_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_performance_weekly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_analytics_weekly" (
    "id" SERIAL NOT NULL,
    "week_ending" DATE NOT NULL,
    "sessions" INTEGER,
    "users" INTEGER,
    "page_views" INTEGER,
    "bounce_rate" DECIMAL(5,2),
    "avg_session_duration" DECIMAL(10,2),
    "new_users" INTEGER,
    "data_source" "DataSource" NOT NULL,
    "upload_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_analytics_weekly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_productivity_weekly" (
    "id" SERIAL NOT NULL,
    "week_ending" DATE NOT NULL,
    "staff_name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "region" "Region",
    "jobs_completed" INTEGER,
    "revenue_generated" DECIMAL(14,2),
    "inspections_completed" INTEGER,
    "data_source" "DataSource" NOT NULL,
    "upload_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_productivity_weekly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_weekly" (
    "id" SERIAL NOT NULL,
    "week_ending" DATE NOT NULL,
    "staff_name" TEXT NOT NULL,
    "inbound_calls" INTEGER,
    "outbound_calls" INTEGER,
    "missed_calls" INTEGER,
    "avg_call_duration" DECIMAL(10,2),
    "data_source" "DataSource" NOT NULL,
    "upload_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_weekly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_position_weekly" (
    "id" SERIAL NOT NULL,
    "week_ending" DATE NOT NULL,
    "everyday_account" DECIMAL(14,2),
    "overdraft_limit" DECIMAL(14,2),
    "tax_savings" DECIMAL(14,2),
    "capital_account" DECIMAL(14,2),
    "credit_cards" DECIMAL(14,2),
    "total_cash_available" DECIMAL(14,2),
    "total_receivables" DECIMAL(14,2),
    "current_receivables" DECIMAL(14,2),
    "over_30_days" DECIMAL(14,2),
    "over_60_days" DECIMAL(14,2),
    "over_90_days" DECIMAL(14,2),
    "total_payables" DECIMAL(14,2),
    "data_source" "DataSource" NOT NULL,
    "upload_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_position_weekly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_reviews_weekly" (
    "id" SERIAL NOT NULL,
    "week_ending" DATE NOT NULL,
    "review_count" INTEGER NOT NULL,
    "average_rating" DECIMAL(3,2),
    "cumulative_count" INTEGER,
    "cumulative_average_rating" DECIMAL(3,2),
    "data_source" "DataSource" NOT NULL,
    "upload_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_reviews_weekly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upcoming_liabilities" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "liability_type" "LiabilityType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upcoming_liabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "targets" (
    "id" SERIAL NOT NULL,
    "target_type" "TargetType" NOT NULL,
    "entity" "Region",
    "amount" DECIMAL(14,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "set_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target_history" (
    "id" SERIAL NOT NULL,
    "target_id" INTEGER NOT NULL,
    "previous_amount" DECIMAL(14,2) NOT NULL,
    "new_amount" DECIMAL(14,2) NOT NULL,
    "changed_by" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "target_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_uploads" (
    "id" SERIAL NOT NULL,
    "file_name" TEXT NOT NULL,
    "data_type" TEXT NOT NULL,
    "mapping_id" INTEGER,
    "rows_processed" INTEGER NOT NULL DEFAULT 0,
    "rows_failed" INTEGER NOT NULL DEFAULT 0,
    "rows_skipped" INTEGER NOT NULL DEFAULT 0,
    "status" "UploadStatus" NOT NULL DEFAULT 'pending',
    "error_log" JSONB,
    "rollback_data" JSONB,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_column_mappings" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "data_type" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_column_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "m365_id" TEXT,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'staff',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "team" TEXT,
    "region" "Region",
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "page" "DashboardPage" NOT NULL,
    "permission_level" "PermissionLevel" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_weekly_week_ending_key" ON "financial_weekly"("week_ending");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_weekly_week_ending_category_key" ON "revenue_weekly"("week_ending", "category");

-- CreateIndex
CREATE UNIQUE INDEX "projects_weekly_week_ending_project_type_key" ON "projects_weekly"("week_ending", "project_type");

-- CreateIndex
CREATE UNIQUE INDEX "sales_weekly_week_ending_sales_type_key" ON "sales_weekly"("week_ending", "sales_type");

-- CreateIndex
CREATE UNIQUE INDEX "sales_regional_weekly_week_ending_region_sales_type_key" ON "sales_regional_weekly"("week_ending", "region", "sales_type");

-- CreateIndex
CREATE UNIQUE INDEX "team_performance_weekly_week_ending_region_key" ON "team_performance_weekly"("week_ending", "region");

-- CreateIndex
CREATE UNIQUE INDEX "leads_weekly_week_ending_source_key" ON "leads_weekly"("week_ending", "source");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_performance_weekly_week_ending_platform_key" ON "marketing_performance_weekly"("week_ending", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "website_analytics_weekly_week_ending_key" ON "website_analytics_weekly"("week_ending");

-- CreateIndex
CREATE UNIQUE INDEX "staff_productivity_weekly_week_ending_staff_name_key" ON "staff_productivity_weekly"("week_ending", "staff_name");

-- CreateIndex
CREATE UNIQUE INDEX "phone_weekly_week_ending_staff_name_key" ON "phone_weekly"("week_ending", "staff_name");

-- CreateIndex
CREATE UNIQUE INDEX "cash_position_weekly_week_ending_key" ON "cash_position_weekly"("week_ending");

-- CreateIndex
CREATE UNIQUE INDEX "google_reviews_weekly_week_ending_key" ON "google_reviews_weekly"("week_ending");

-- CreateIndex
CREATE INDEX "targets_target_type_entity_effective_from_idx" ON "targets"("target_type", "entity", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "users_m365_id_key" ON "users"("m365_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_page_key" ON "user_permissions"("user_id", "page");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "financial_weekly" ADD CONSTRAINT "financial_weekly_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "csv_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_weekly" ADD CONSTRAINT "revenue_weekly_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "csv_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects_weekly" ADD CONSTRAINT "projects_weekly_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "csv_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_weekly" ADD CONSTRAINT "sales_weekly_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "csv_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_regional_weekly" ADD CONSTRAINT "sales_regional_weekly_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "csv_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_performance_weekly" ADD CONSTRAINT "team_performance_weekly_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "csv_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads_weekly" ADD CONSTRAINT "leads_weekly_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "csv_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_performance_weekly" ADD CONSTRAINT "marketing_performance_weekly_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "csv_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_analytics_weekly" ADD CONSTRAINT "website_analytics_weekly_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "csv_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_productivity_weekly" ADD CONSTRAINT "staff_productivity_weekly_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "csv_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_weekly" ADD CONSTRAINT "phone_weekly_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "csv_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_position_weekly" ADD CONSTRAINT "cash_position_weekly_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "csv_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_reviews_weekly" ADD CONSTRAINT "google_reviews_weekly_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "csv_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_history" ADD CONSTRAINT "target_history_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_uploads" ADD CONSTRAINT "csv_uploads_mapping_id_fkey" FOREIGN KEY ("mapping_id") REFERENCES "csv_column_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

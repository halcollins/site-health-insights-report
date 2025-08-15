import { pgTable, text, serial, integer, boolean, uuid, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Define enums
export const riskLevelEnum = pgEnum('risk_level', ['critical', 'high', 'medium', 'low']);
export const dataSourceEnum = pgEnum('data_source', ['real', 'estimated']);
export const confidenceEnum = pgEnum('confidence', ['high', 'medium', 'low']);
export const imageOptimizationEnum = pgEnum('image_optimization', ['good', 'needs-improvement', 'poor']);
export const cachingEnum = pgEnum('caching', ['enabled', 'partial', 'disabled']);

// Leads table
export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company"),
  websiteUrl: text("website_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Analysis reports table
export const analysisReports = pgTable("analysis_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  performanceScore: integer("performance_score"),
  mobileScore: integer("mobile_score"),
  isWordpress: boolean("is_wordpress").default(false),
  wpVersion: text("wp_version"),
  theme: text("theme"),
  plugins: integer("plugins"),
  hasSSL: boolean("has_ssl").default(false),
  hasCDN: boolean("has_cdn").default(false),
  imageOptimization: imageOptimizationEnum("image_optimization"),
  caching: cachingEnum("caching"),
  recommendations: jsonb("recommendations"),
  technologies: jsonb("technologies"),
  dataSource: dataSourceEnum("data_source"),
  confidence: confidenceEnum("confidence"),
  riskLevel: riskLevelEnum("risk_level"),
  analysisTimestamp: timestamp("analysis_timestamp", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Users table (keeping existing)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Relations
export const leadsRelations = relations(leads, ({ many }) => ({
  analysisReports: many(analysisReports),
}));

export const analysisReportsRelations = relations(analysisReports, ({ one }) => ({
  lead: one(leads, {
    fields: [analysisReports.leadId],
    references: [leads.id],
  }),
}));

// Insert schemas
export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAnalysisReportSchema = createInsertSchema(analysisReports).omit({
  id: true,
  createdAt: true,
  analysisTimestamp: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Types
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type AnalysisReport = typeof analysisReports.$inferSelect;
export type InsertAnalysisReport = z.infer<typeof insertAnalysisReportSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

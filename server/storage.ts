import { users, leads, analysisReports, type User, type InsertUser, type Lead, type InsertLead, type AnalysisReport, type InsertAnalysisReport } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Storage interface for all database operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Lead operations
  createLead(lead: InsertLead): Promise<Lead>;
  getLeadById(id: string): Promise<Lead | undefined>;
  getLeadByEmail(email: string): Promise<Lead | undefined>;
  
  // Analysis report operations
  createAnalysisReport(report: InsertAnalysisReport): Promise<AnalysisReport>;
  getAnalysisReportsByLeadId(leadId: string): Promise<AnalysisReport[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Lead operations
  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db
      .insert(leads)
      .values(insertLead)
      .returning();
    return lead;
  }

  async getLeadById(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || undefined;
  }

  async getLeadByEmail(email: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.email, email));
    return lead || undefined;
  }

  // Analysis report operations
  async createAnalysisReport(insertReport: InsertAnalysisReport): Promise<AnalysisReport> {
    const [report] = await db
      .insert(analysisReports)
      .values(insertReport)
      .returning();
    return report;
  }

  async getAnalysisReportsByLeadId(leadId: string): Promise<AnalysisReport[]> {
    return await db.select().from(analysisReports).where(eq(analysisReports.leadId, leadId));
  }
}

export const storage = new DatabaseStorage();

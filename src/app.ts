import { relations } from "drizzle-orm";
import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

const timestamps = {
    createdAt: varchar('created_at', { length: 255 }).notNull().default('CURRENT_TIMESTAMP'),
    updatedAt: varchar('updated_at', { length: 255 }).notNull().default('CURRENT_TIMESTAMP').$onUpdate(() => new Date().toISOString()).notNull(),
};

export const departments = pgTable('departments', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 50 }).notNull().unique(),
    description: varchar('description', { length: 500 }),
    ...timestamps
});

export const subjects = pgTable('subjects', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    departmentId: integer('department_id').notNull().references(() => departments.id, { onUpdate: 'restrict' }),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 50 }).notNull().unique(),
    description: varchar('description', { length: 500 }),
    ...timestamps
});

export const departmentrelationships = relations(departments, ({many}) => ({subjects: many(subjects)}));

export const subjectRelationships = relations(subjects, ({one}) => ({
    department: one(departments, {
        fields: [subjects.departmentId],
        references: [departments.id],
    })
}));

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;
import { relations } from "drizzle-orm";
import { boolean, integer, pgEnum, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

const timestamps = {
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
};

export const userRoleEnum = pgEnum('user_role', ['admin', 'teacher', 'student']);

export const departments = pgTable('departments', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    description: varchar('description', { length: 500 }),
    ...timestamps,
});

export const subjects = pgTable('subjects', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    departmentId: integer('department_id')
        .notNull()
        .references(() => departments.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    description: varchar('description', { length: 500 }),
    ...timestamps,
});

export const user = pgTable('user', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: varchar('image', { length: 500 }),
    imageCldPubId: varchar('image_cld_pub_id', { length: 255 }),
    role: userRoleEnum('role').notNull().default('student'),
    ...timestamps,
});

export const classes = pgTable('classes', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    subjectId: integer('subject_id')
        .notNull()
        .references(() => subjects.id, { onDelete: 'cascade', onUpdate: 'restrict' }),
    teacherId: integer('teacher_id')
        .notNull()
        .references(() => user.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 500 }),
    ...timestamps,
});

export const enrollments = pgTable('enrollments', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    classId: integer('class_id')
        .notNull()
        .references(() => classes.id, { onDelete: 'cascade', onUpdate: 'restrict' }),
    studentId: integer('student_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade', onUpdate: 'restrict' }),
    ...timestamps,
});

export const departmentRelations = relations(departments, ({ many }) => ({
    subjects: many(subjects),
}));

export const subjectRelations = relations(subjects, ({ one, many }) => ({
    department: one(departments, {
        fields: [subjects.departmentId],
        references: [departments.id],
    }),
    classes: many(classes),
}));

export const userRelations = relations(user, ({ many }) => ({
    taughtClasses: many(classes),
    enrollments: many(enrollments),
}));

export const classRelations = relations(classes, ({ one, many }) => ({
    subject: one(subjects, {
        fields: [classes.subjectId],
        references: [subjects.id],
    }),
    teacher: one(user, {
        fields: [classes.teacherId],
        references: [user.id],
    }),
    enrollments: many(enrollments),
}));

export const enrollmentRelations = relations(enrollments, ({ one }) => ({
    class: one(classes, {
        fields: [enrollments.classId],
        references: [classes.id],
    }),
    student: one(user, {
        fields: [enrollments.studentId],
        references: [user.id],
    }),
}));

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;
export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
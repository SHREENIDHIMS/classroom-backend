import express from 'express';
import { and, desc, eq, getTableColumns, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { classes, departments, enrollments, subjects, user } from '../schema.js';

const router = express.Router();

function parsePaginationParam(value: unknown, defaultValue: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : defaultValue;
}

function toCount(raw: unknown): number {
    return Number(raw) || 0;
}

function isDuplicateError(error: any): boolean {
    return error?.code === '23505' ||
        error?.message?.includes('unique') ||
        error?.message?.includes('duplicate');
}

// GET /subjects
router.get('/', async (req, res) => {
    try {
        const { search, department, page, limit } = req.query;
        const currentPage = parsePaginationParam(page, 1);
        const limitPerPage = parsePaginationParam(limit, 10);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];
        if (search) {
            filterConditions.push(
                or(
                    ilike(subjects.name, `%${search}%`),
                    ilike(subjects.code, `%${search}%`),
                ),
            );
        }
        if (department) {
            filterConditions.push(ilike(departments.name, `%${department}%`));
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const [countRow] = await db
            .select({ count: sql<number>`count(*)` })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause);

        const totalCount = toCount(countRow?.count);

        const data = await db
            .select({
                ...getTableColumns(subjects),
                department: { ...getTableColumns(departments) },
            })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause)
            .orderBy(desc(subjects.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        return res.status(200).json({
            data,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            },
        });
    } catch (error) {
        console.error('GET /subjects error:', error);
        return res.status(500).json({ error: 'Failed to fetch subjects' });
    }
});

// POST /subjects
router.post('/', async (req, res) => {
    try {
        const { departmentId, name, code, description } = req.body;

        if (!departmentId || !name || !code) {
            return res.status(400).json({ error: 'departmentId, name, and code are required' });
        }

        const [created] = await db
            .insert(subjects)
            .values({ departmentId: Number(departmentId), name, code, description })
            .returning();

        if (!created) throw new Error('Insert returned no row');

        return res.status(201).json({ data: created });
    } catch (error: any) {
        console.error('POST /subjects error:', error);
        if (isDuplicateError(error)) {
            return res.status(409).json({ error: 'A subject with that name or code already exists' });
        }
        return res.status(500).json({ error: 'Failed to create subject' });
    }
});

// GET /subjects/:id
router.get('/:id', async (req, res) => {
    try {
        const subjectId = Number(req.params.id);
        if (!Number.isFinite(subjectId)) {
            return res.status(400).json({ error: 'Invalid subject id' });
        }

        const [subject] = await db
            .select({
                ...getTableColumns(subjects),
                department: { ...getTableColumns(departments) },
            })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(eq(subjects.id, subjectId));

        if (!subject) {
            return res.status(404).json({ error: 'Subject not found' });
        }

        const [classesCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(classes)
            .where(eq(classes.subjectId, subjectId));

        return res.status(200).json({
            data: {
                subject,
                totals: { classes: toCount(classesCount?.count) },
            },
        });
    } catch (error) {
        console.error('GET /subjects/:id error:', error);
        return res.status(500).json({ error: 'Failed to fetch subject details' });
    }
});

// PATCH /subjects/:id
router.patch('/:id', async (req, res) => {
    try {
        const subjectId = Number(req.params.id);
        if (!Number.isFinite(subjectId)) {
            return res.status(400).json({ error: 'Invalid subject id' });
        }

        const { name, code, description, departmentId } = req.body;

        if (!name && !code && !description && !departmentId) {
            return res.status(400).json({ error: 'Provide at least one field to update' });
        }

        const [updated] = await db
            .update(subjects)
            .set({
                ...(name && { name }),
                ...(code && { code }),
                ...(description !== undefined && { description }),
                ...(departmentId && { departmentId: Number(departmentId) }),
            })
            .where(eq(subjects.id, subjectId))
            .returning();

        if (!updated) {
            return res.status(404).json({ error: 'Subject not found' });
        }

        return res.status(200).json({ data: updated });
    } catch (error: any) {
        console.error('PATCH /subjects/:id error:', error);
        if (isDuplicateError(error)) {
            return res.status(409).json({ error: 'A subject with that name or code already exists' });
        }
        return res.status(500).json({ error: 'Failed to update subject' });
    }
});

// DELETE /subjects/:id
router.delete('/:id', async (req, res) => {
    try {
        const subjectId = Number(req.params.id);
        if (!Number.isFinite(subjectId)) {
            return res.status(400).json({ error: 'Invalid subject id' });
        }

        const [deleted] = await db
            .delete(subjects)
            .where(eq(subjects.id, subjectId))
            .returning();

        if (!deleted) {
            return res.status(404).json({ error: 'Subject not found' });
        }

        return res.status(200).json({ data: deleted });
    } catch (error: any) {
        console.error('DELETE /subjects/:id error:', error);
        if (error?.code === '23503') {
            return res.status(409).json({ error: 'Cannot delete — subject still has classes linked to it' });
        }
        return res.status(500).json({ error: 'Failed to delete subject' });
    }
});

// GET /subjects/:id/classes
router.get('/:id/classes', async (req, res) => {
    try {
        const subjectId = Number(req.params.id);
        if (!Number.isFinite(subjectId)) {
            return res.status(400).json({ error: 'Invalid subject id' });
        }

        const { page, limit } = req.query;
        const currentPage = parsePaginationParam(page, 1);
        const limitPerPage = parsePaginationParam(limit, 10);
        const offset = (currentPage - 1) * limitPerPage;

        const [countRow] = await db
            .select({ count: sql<number>`count(*)` })
            .from(classes)
            .where(eq(classes.subjectId, subjectId));

        const totalCount = toCount(countRow?.count);

        const data = await db
            .select({
                ...getTableColumns(classes),
                teacher: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    image: user.image,
                    role: user.role,
                },
            })
            .from(classes)
            .leftJoin(user, eq(classes.teacherId, user.id))
            .where(eq(classes.subjectId, subjectId))
            .orderBy(desc(classes.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        return res.status(200).json({
            data,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            },
        });
    } catch (error) {
        console.error('GET /subjects/:id/classes error:', error);
        return res.status(500).json({ error: 'Failed to fetch subject classes' });
    }
});

// GET /subjects/:id/users?role=teacher|student
router.get('/:id/users', async (req, res) => {
    try {
        const subjectId = Number(req.params.id);
        if (!Number.isFinite(subjectId)) {
            return res.status(400).json({ error: 'Invalid subject id' });
        }

        const { role, page, limit } = req.query;

        if (role !== 'teacher' && role !== 'student') {
            return res.status(400).json({ error: 'Query param "role" must be "teacher" or "student"' });
        }

        const currentPage = parsePaginationParam(page, 1);
        const limitPerPage = parsePaginationParam(limit, 10);
        const offset = (currentPage - 1) * limitPerPage;

        const safeUserSelect = {
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: user.emailVerified,
            image: user.image,
            imageCldPubId: user.imageCldPubId,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };

        const groupByFields = [
            user.id, user.name, user.email, user.emailVerified,
            user.image, user.imageCldPubId, user.role,
            user.createdAt, user.updatedAt,
        ] as const;

        let totalCount: number;
        let data: any[];

        if (role === 'teacher') {
            const [countRow] = await db
                .select({ count: sql<number>`count(distinct ${user.id})` })
                .from(user)
                .innerJoin(classes, eq(user.id, classes.teacherId))
                .where(and(eq(user.role, 'teacher'), eq(classes.subjectId, subjectId)));

            totalCount = toCount(countRow?.count);

            data = await db
                .select(safeUserSelect)
                .from(user)
                .innerJoin(classes, eq(user.id, classes.teacherId))
                .where(and(eq(user.role, 'teacher'), eq(classes.subjectId, subjectId)))
                .groupBy(...groupByFields)
                .orderBy(desc(user.createdAt))
                .limit(limitPerPage)
                .offset(offset);
        } else {
            const [countRow] = await db
                .select({ count: sql<number>`count(distinct ${user.id})` })
                .from(user)
                .innerJoin(enrollments, eq(user.id, enrollments.studentId))
                .innerJoin(classes, eq(enrollments.classId, classes.id))
                .where(and(eq(user.role, 'student'), eq(classes.subjectId, subjectId)));

            totalCount = toCount(countRow?.count);

            data = await db
                .select(safeUserSelect)
                .from(user)
                .innerJoin(enrollments, eq(user.id, enrollments.studentId))
                .innerJoin(classes, eq(enrollments.classId, classes.id))
                .where(and(eq(user.role, 'student'), eq(classes.subjectId, subjectId)))
                .groupBy(...groupByFields)
                .orderBy(desc(user.createdAt))
                .limit(limitPerPage)
                .offset(offset);
        }

        return res.status(200).json({
            data,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            },
        });
    } catch (error) {
        console.error('GET /subjects/:id/users error:', error);
        return res.status(500).json({ error: 'Failed to fetch subject users' });
    }
});

export default router;
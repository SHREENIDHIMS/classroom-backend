import express from 'express';
import { desc, eq, getTableColumns, ilike, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { departments, subjects } from '../schema.js';

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

// GET /departments
router.get('/', async (req, res) => {
    try {
        const { search, page, limit } = req.query;
        const currentPage = parsePaginationParam(page, 1);
        const limitPerPage = parsePaginationParam(limit, 10);
        const offset = (currentPage - 1) * limitPerPage;

        const whereClause = search ? ilike(departments.name, `%${search}%`) : undefined;

        const [countRow] = await db
            .select({ count: sql<number>`count(*)` })
            .from(departments)
            .where(whereClause);

        const totalCount = toCount(countRow?.count);

        const data = await db
            .select(getTableColumns(departments))
            .from(departments)
            .where(whereClause)
            .orderBy(desc(departments.createdAt))
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
        console.error('GET /departments error:', error);
        return res.status(500).json({ error: 'Failed to fetch departments' });
    }
});

// POST /departments
router.post('/', async (req, res) => {
    try {
        const { name, code, description } = req.body;

        if (!name || !code) {
            return res.status(400).json({ error: 'name and code are required' });
        }

        const [created] = await db
            .insert(departments)
            .values({ name, code, description })
            .returning();

        if (!created) throw new Error('Insert returned no row');

        return res.status(201).json({ data: created });
    } catch (error: any) {
        console.error('POST /departments error:', error);
        if (isDuplicateError(error)) {
            return res.status(409).json({ error: 'A department with that name or code already exists' });
        }
        return res.status(500).json({ error: 'Failed to create department' });
    }
});

// GET /departments/:id
router.get('/:id', async (req, res) => {
    try {
        const deptId = Number(req.params.id);
        if (!Number.isFinite(deptId)) {
            return res.status(400).json({ error: 'Invalid department id' });
        }

        const [department] = await db
            .select(getTableColumns(departments))
            .from(departments)
            .where(eq(departments.id, deptId));

        if (!department) {
            return res.status(404).json({ error: 'Department not found' });
        }

        const [subjectsCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(subjects)
            .where(eq(subjects.departmentId, deptId));

        return res.status(200).json({
            data: {
                department,
                totals: { subjects: toCount(subjectsCount?.count) },
            },
        });
    } catch (error) {
        console.error('GET /departments/:id error:', error);
        return res.status(500).json({ error: 'Failed to fetch department' });
    }
});

// PATCH /departments/:id
router.patch('/:id', async (req, res) => {
    try {
        const deptId = Number(req.params.id);
        if (!Number.isFinite(deptId)) {
            return res.status(400).json({ error: 'Invalid department id' });
        }

        const { name, code, description } = req.body;

        if (!name && !code && !description) {
            return res.status(400).json({ error: 'Provide at least one field to update' });
        }

        const [updated] = await db
            .update(departments)
            .set({
                ...(name && { name }),
                ...(code && { code }),
                ...(description !== undefined && { description }),
            })
            .where(eq(departments.id, deptId))
            .returning();

        if (!updated) {
            return res.status(404).json({ error: 'Department not found' });
        }

        return res.status(200).json({ data: updated });
    } catch (error: any) {
        console.error('PATCH /departments/:id error:', error);
        if (isDuplicateError(error)) {
            return res.status(409).json({ error: 'A department with that name or code already exists' });
        }
        return res.status(500).json({ error: 'Failed to update department' });
    }
});

// DELETE /departments/:id
router.delete('/:id', async (req, res) => {
    try {
        const deptId = Number(req.params.id);
        if (!Number.isFinite(deptId)) {
            return res.status(400).json({ error: 'Invalid department id' });
        }

        const [deleted] = await db
            .delete(departments)
            .where(eq(departments.id, deptId))
            .returning();

        if (!deleted) {
            return res.status(404).json({ error: 'Department not found' });
        }

        return res.status(200).json({ data: deleted });
    } catch (error: any) {
        console.error('DELETE /departments/:id error:', error);
        if (error?.code === '23503') {
            return res.status(409).json({ error: 'Cannot delete — department still has subjects linked to it' });
        }
        return res.status(500).json({ error: 'Failed to delete department' });
    }
});

export default router;
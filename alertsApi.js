app.get('/api/companies/:companyId/alerts/low-stock', async (req, res) => {
    try {
        const { companyId } = req.params;

        // Optimized JOIN query
        const products = await db.query(`
            SELECT p.id, p.name, p.sku, w.id as warehouse_id, w.name as warehouse_name,
                   i.quantity, s.id as supplier_id, s.name as supplier_name, s.email
            FROM products p
            JOIN inventory i ON p.id = i.product_id
            JOIN warehouses w ON i.warehouse_id = w.id
            JOIN suppliers s ON p.supplier_id = s.id
            WHERE w.company_id = ?`, [companyId]);

        const alerts = [];
        const THRESHOLD = 20;

        for (const item of products) {
            if (item.quantity < THRESHOLD) {
                alerts.push({
                    product_id: item.id,
                    product_name: item.name,
                    sku: item.sku,
                    warehouse_name: item.warehouse_name,
                    current_stock: item.quantity,
                    supplier: {
                        name: item.supplier_name,
                        contact_email: item.email
                    }
                });
            }
        }

        res.json({ alerts, total_alerts: alerts.length });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server Error" });
    }
});

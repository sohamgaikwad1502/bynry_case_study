// POST /api/products
app.post('/api/products', async (req, res) => {
    const t = await sequelize.transaction(); // Start Transaction

    try {
        const { name, sku, price, warehouse_id, initial_quantity } = req.body;

        // 1. Validation
        if (!name || !sku || !price || !warehouse_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // 2. Create Product (Linked to Transaction 't')
        const newProduct = await Product.create({
            name, sku, price
        }, { transaction: t });

        // 3. Create Inventory (Linked to Transaction 't')
        await Inventory.create({
            productId: newProduct.id,
            warehouseId: warehouse_id,
            quantity: initial_quantity || 0
        }, { transaction: t });

        // 4. Commit (Save Everything)
        await t.commit();

        return res.status(201).json({
            message: "Product created successfully",
            product_id: newProduct.id
        });

    } catch (error) {
        // 5. Rollback (Undo all changes on error)
        await t.rollback();
        console.error("Creation failed:", error);
        return res.status(500).json({ error: "Failed to create product" });
    }
});

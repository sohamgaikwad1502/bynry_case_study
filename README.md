# StockFlow - Backend Engineering Case Study

**Submitted by:** Soham Gaikwad 
**Role:** Backend Engineering Intern Applicant  
**Date:** January 2026

## 📌 Overview
This repository contains the solution for the **StockFlow Backend Case Study**. The project focuses on fixing a broken legacy codebase, designing a scalable database schema for a multi-warehouse inventory system, and implementing a high-performance API for low-stock alerts.

**Google Docs Link** - https://docs.google.com/document/d/12s0g-eW4B0eeQerzxaetYGa56eEtRGZYWWJt_CxV-hM/edit?usp=sharing

### 🗂 Table of Contents
- [Part 1: Code Review & Debugging](#-part-1-code-review--debugging)
- [Part 2: Database Schema Design](#-part-2-database-schema-design)
- [Part 3: API Implementation](#-part-3-api-implementation)
- [Assumptions](#-assumptions)

---

## 🛠 Part 1: Code Review & Debugging

### 🚩 Identified Issues
1.  **Lack of Atomicity (Critical):** The original code committed the `Product` to the database *before* attempting to create the `Inventory` record. If the inventory step failed, the database would be left with "orphan" products that had no stock records.
2.  **Missing Input Validation:** There were no checks for required fields (`name`, `sku`, `price`), which could lead to server crashes if incomplete JSON was sent.
3.  **No Error Handling:** The absence of `try/catch` blocks meant that database errors (like duplicate SKUs) would throw raw 500 errors to the client without explanation.

### ✅ The Fix (Express.js + Sequelize)
I rewrote the endpoint using **Database Transactions** to ensure data integrity. If any step fails, the entire operation rolls back.

```javascript
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

```

---

## 🗄 Part 2: Database Schema Design

### Schema Overview

The database is normalized to handle a many-to-many relationship between **Products** and **Warehouses**.

* **Companies:** `id (PK)`, `name`
* **Warehouses:** `id (PK)`, `company_id (FK)`, `location`
* **Products:** `id (PK)`, `sku`, `supplier_id (FK)`
* **Inventory:** The join table linking Products and Warehouses (`product_id`, `warehouse_id`, `quantity`).
* **Suppliers:** `id (PK)`, `name`, `contact_info`

### Schema Diagram

<img width="728" height="430" alt="image" src="https://github.com/user-attachments/assets/b567d8b4-944e-4ae1-9ba2-16a36f688404" />



### Key Design Decisions

1. **Decimal for Price:** Used `Decimal` type instead of Float to prevent floating-point math errors (e.g., $0.1 + $0.2 != $0.30004).
2. **Separate Inventory Table:** Separating inventory from products allows a single product SKU to exist in multiple warehouses with different quantities without duplicating product details.

---

## 🚀 Part 3: API Implementation

**Endpoint:** `GET /api/companies/:company_id/alerts/low-stock`

### Implementation Logic

* **Efficient Querying:** Used a single SQL `JOIN` query to fetch Product, Inventory, Warehouse, and Supplier data in one go. This avoids the "N+1 Query Problem" (looping through products and querying the DB for each one).
* **Business Logic:** Filters products where `quantity < 20` and returns a formatted JSON response including supplier details for easy reordering.

```javascript
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

```

---

## 📝 Assumptions

* **ORM:** The solution assumes a standard Node.js ORM (like Sequelize) is properly configured.
* **Currency:** The system currently assumes a single currency (USD).
* **Threshold:** A static threshold of `20` units is used for low-stock alerts. In a production environment, this would likely be a dynamic column (`min_stock_level`) in the `Products` table.

```

```

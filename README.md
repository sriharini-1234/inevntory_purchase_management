# StockPilot — Inventory & Purchase Management System

A responsive inventory management application built with **React + Vite**, **Python FastAPI**, **SQLAlchemy**, and **Microsoft SQL Server**.

## Included features

- Product and supplier CRUD APIs and UI
- Dashboard: product count, total units, inventory value, low-stock alerts
- Stock receipt and stock issue workflows
- Atomic stock updates; issue requests cannot make stock negative
- Transaction history with product/reference search
- Product search and category filtering
- Dashboard auto-refresh every 10 seconds, with a manual refresh and connection status
- One-click restocking from low-stock alerts, movement-type filtering, and transaction CSV export
- Editable administrator name and email with a profile menu and browser-local persistence
- Pydantic validation, clear API errors, and database constraints
- Pytest API tests and sample data seeder
- Responsive desktop, tablet, and mobile layout

## 1. Requirements

- Python 3.10+
- Node.js 18+
- SQL Server (or SQLite for a quick demo)
- Microsoft ODBC Driver 17 or 18 for SQL Server when using SQL Server

## 2. Backend setup (Windows PowerShell)

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and set the correct SQL Server connection string.
`FRONTEND_ORIGIN` accepts comma-separated browser origins; the sample allows both `localhost:5173` and `127.0.0.1:5173`.

### SQL Server connection examples

**Windows Authentication:**
```env
DATABASE_URL=mssql+pyodbc://@localhost/InventoryDB?driver=ODBC+Driver+17+for+SQL+Server&trusted_connection=yes&TrustServerCertificate=yes
```

**SQL Server Express named instance:**
```env
DATABASE_URL=mssql+pyodbc://@localhost\\SQLEXPRESS/InventoryDB?driver=ODBC+Driver+17+for+SQL+Server&trusted_connection=yes&TrustServerCertificate=yes
```

Create the database once in SQL Server Management Studio:
```sql
CREATE DATABASE InventoryDB;
```

If your installed ODBC driver is version 18, replace `ODBC Driver 17 for SQL Server` with `ODBC Driver 18 for SQL Server`.

### Quick demo without SQL Server

To test the application quickly, put this in `backend/.env`:
```env
DATABASE_URL=sqlite:///./inventory.db
```
The app creates the tables automatically when it starts.

### Seed sample data and start API

```powershell
python seed.py
uvicorn app.main:app --reload
```

Backend: http://localhost:8000  
Swagger API docs: http://localhost:8000/docs

## 3. Frontend setup

Open a second PowerShell terminal:
```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Frontend: http://localhost:5173

If your backend runs at another address, update `VITE_API_URL` in `frontend/.env`.

## 4. Run tests

From the `backend` folder with the virtual environment activated:
```powershell
pytest -q
```

Tests cover stock receipt, stock issue, transaction creation, negative-stock prevention, and duplicate SKU handling.

## 5. Main API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/dashboard` | Dashboard metrics and alerts |
| GET/POST | `/api/products` | List/create products |
| PUT/DELETE | `/api/products/{id}` | Update/delete product |
| GET/POST | `/api/suppliers` | List/create suppliers |
| PUT/DELETE | `/api/suppliers/{id}` | Update/delete supplier |
| POST | `/api/stock/movements` | Record receipt or issue |
| GET | `/api/transactions` | Transaction history |

Search examples:
- `/api/products?search=mouse`
- `/api/products?low_stock=true`
- `/api/transactions?search=PO-1001`
- `/api/transactions?transaction_type=RECEIPT`

## 6. Database design

- `suppliers`: supplier master data
- `products`: product master data and current stock
- `stock_transactions`: immutable stock movement history

Relationships:
- One supplier can supply many products.
- One product can have many stock transactions.
- Transaction rows reference products using a foreign key.

Stock is changed only through the stock movement endpoint. The endpoint updates stock and inserts its transaction record in one database transaction. For issues, the update includes a `stock_quantity >= requested_quantity` condition, preventing concurrent issue requests from reducing stock below zero.

## 7. Suggested project demonstration

1. Open dashboard and explain the four summary cards.
2. Add a supplier.
3. Add a product with an opening quantity and reorder level.
4. Record a stock receipt and show the quantity increasing.
5. Record a stock issue and show the quantity decreasing.
6. Try issuing more than the available stock; show the API/UI error and unchanged quantity.
7. Open transaction history and show both movements.
8. Change stock below the reorder level and show the dashboard alert.
9. Resize the browser to demonstrate responsive behavior.

## Notes

- Product opening stock is entered when a product is first created. After creation, stock quantity is intentionally read-only in the product edit API; use stock receipt/issue so that every stock change has an audit record.
- Products with transaction history cannot be deleted, preserving the audit trail.
- This is a learning/demo foundation. Before production use, add authentication/authorization, role permissions, database migrations (Alembic), pagination, structured logging, and deployment secrets management.
- The editable administrator profile is stored in the current browser and is not an authenticated user account.

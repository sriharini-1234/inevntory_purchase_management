from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func, update, or_
from sqlalchemy.exc import IntegrityError
from .database import Base, engine, get_db
from . import models, schemas
import os

Base.metadata.create_all(bind=engine)
app = FastAPI(title="Inventory & Purchase Management API", version="1.0.0",
              description="Products, suppliers, stock receipts/issues and inventory dashboard.")
frontend_origins = [origin.strip() for origin in
                    os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=frontend_origins,
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

def product_out(p):
    return schemas.ProductOut(
        id=p.id, sku=p.sku, name=p.name, description=p.description, category=p.category,
        unit=p.unit, unit_price=float(p.unit_price), stock_quantity=p.stock_quantity,
        reorder_level=p.reorder_level, supplier_id=p.supplier_id,
        supplier_name=p.supplier.name if p.supplier else None,
        low_stock=p.stock_quantity <= p.reorder_level
    )

def transaction_out(t):
    return schemas.TransactionOut(id=t.id, product_id=t.product_id, product_name=t.product.name,
        sku=t.product.sku, transaction_type=t.transaction_type, quantity=t.quantity,
        unit_cost=float(t.unit_cost) if t.unit_cost is not None else None,
        reference=t.reference, notes=t.notes, created_at=t.created_at)

@app.get("/")
def root():
    return {"message": "Inventory & Purchase Management API", "docs": "/docs"}

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/suppliers", response_model=list[schemas.SupplierOut])
def list_suppliers(db: Session = Depends(get_db)):
    return db.scalars(select(models.Supplier).order_by(models.Supplier.name)).all()

@app.post("/api/suppliers", response_model=schemas.SupplierOut, status_code=201)
def create_supplier(payload: schemas.SupplierCreate, db: Session = Depends(get_db)):
    obj = models.Supplier(**payload.model_dump())
    db.add(obj)
    try:
        db.commit(); db.refresh(obj)
    except IntegrityError:
        db.rollback(); raise HTTPException(409, "A supplier with this email already exists.")
    return obj

@app.put("/api/suppliers/{supplier_id}", response_model=schemas.SupplierOut)
def update_supplier(supplier_id: int, payload: schemas.SupplierCreate, db: Session = Depends(get_db)):
    obj = db.get(models.Supplier, supplier_id)
    if not obj: raise HTTPException(404, "Supplier not found.")
    for key, value in payload.model_dump().items(): setattr(obj, key, value)
    try:
        db.commit(); db.refresh(obj)
    except IntegrityError:
        db.rollback(); raise HTTPException(409, "Supplier email already exists.")
    return obj

@app.delete("/api/suppliers/{supplier_id}", status_code=204)
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Supplier, supplier_id)
    if not obj: raise HTTPException(404, "Supplier not found.")
    # Unlink products before deleting supplier for consistent behavior across DB engines.
    for p in db.scalars(select(models.Product).where(models.Product.supplier_id == supplier_id)):
        p.supplier_id = None
    db.delete(obj); db.commit()

@app.get("/api/products", response_model=list[schemas.ProductOut])
def list_products(search: str | None = None, category: str | None = None,
                  low_stock: bool = False, db: Session = Depends(get_db)):
    stmt = select(models.Product).options(joinedload(models.Product.supplier)).order_by(models.Product.name)
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(models.Product.name.ilike(term), models.Product.sku.ilike(term),
                              models.Product.category.ilike(term)))
    if category: stmt = stmt.where(models.Product.category == category)
    products = db.scalars(stmt).unique().all()
    if low_stock: products = [p for p in products if p.stock_quantity <= p.reorder_level]
    return [product_out(p) for p in products]

@app.post("/api/products", response_model=schemas.ProductOut, status_code=201)
def create_product(payload: schemas.ProductCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    supplier_id = data.get("supplier_id")
    if supplier_id and not db.get(models.Supplier, supplier_id): raise HTTPException(400, "Selected supplier does not exist.")
    obj = models.Product(**data)
    db.add(obj)
    try:
        db.flush()
        # Record opening inventory so the stock ledger accounts for the initial balance.
        if obj.stock_quantity > 0:
            db.add(models.StockTransaction(product_id=obj.id, transaction_type="RECEIPT",
                quantity=obj.stock_quantity, unit_cost=obj.unit_price, reference="OPENING",
                notes="Opening stock at product creation"))
        db.commit(); db.refresh(obj)
    except IntegrityError:
        db.rollback(); raise HTTPException(409, "SKU already exists or product data violates a database constraint.")
    return product_out(obj)

@app.put("/api/products/{product_id}", response_model=schemas.ProductOut)
def update_product(product_id: int, payload: schemas.ProductUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.Product, product_id)
    if not obj: raise HTTPException(404, "Product not found.")
    if payload.supplier_id and not db.get(models.Supplier, payload.supplier_id): raise HTTPException(400, "Selected supplier does not exist.")
    # Stock must only change through receipt/issue endpoints to preserve the audit trail.
    data = payload.model_dump()
    if data["stock_quantity"] != obj.stock_quantity:
        raise HTTPException(400, "Use the stock receipt/issue operation to change stock quantity.")
    for key, value in data.items():
        if key != "stock_quantity": setattr(obj, key, value)
    try: db.commit(); db.refresh(obj)
    except IntegrityError:
        db.rollback(); raise HTTPException(409, "SKU already exists or product data violates a database constraint.")
    return product_out(obj)

@app.delete("/api/products/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Product, product_id)
    if not obj: raise HTTPException(404, "Product not found.")
    if db.scalar(select(func.count(models.StockTransaction.id)).where(models.StockTransaction.product_id == product_id)):
        raise HTTPException(409, "This product has transaction history and cannot be deleted. Keep it for audit purposes.")
    db.delete(obj); db.commit()

@app.post("/api/stock/movements", response_model=schemas.TransactionOut, status_code=201)
def create_stock_movement(payload: schemas.StockMovementCreate, db: Session = Depends(get_db)):
    product = db.get(models.Product, payload.product_id)
    if not product: raise HTTPException(404, "Product not found.")
    # End the read transaction before beginning the atomic write transaction.
    db.rollback()
    # Conditional UPDATE makes stock issue atomic: concurrent requests cannot take stock below zero.
    try:
        with db.begin():
            if payload.transaction_type == "RECEIPT":
                db.execute(update(models.Product).where(models.Product.id == payload.product_id)
                           .values(stock_quantity=models.Product.stock_quantity + payload.quantity))
            else:
                result = db.execute(update(models.Product).where(
                    models.Product.id == payload.product_id,
                    models.Product.stock_quantity >= payload.quantity
                ).values(stock_quantity=models.Product.stock_quantity - payload.quantity))
                if result.rowcount == 0:
                    raise HTTPException(409, f"Insufficient stock. Available quantity: {product.stock_quantity}.")
            tx = models.StockTransaction(**payload.model_dump())
            db.add(tx)
        db.refresh(tx)
        return transaction_out(tx)
    except HTTPException:
        raise
    except IntegrityError:
        db.rollback(); raise HTTPException(400, "Stock movement could not be saved.")

@app.get("/api/transactions", response_model=list[schemas.TransactionOut])
def list_transactions(search: str | None = None, transaction_type: str | None = None,
                      limit: int = Query(default=100, ge=1, le=500), db: Session = Depends(get_db)):
    stmt = select(models.StockTransaction).options(joinedload(models.StockTransaction.product)).order_by(models.StockTransaction.created_at.desc())
    if transaction_type in ("RECEIPT", "ISSUE"): stmt = stmt.where(models.StockTransaction.transaction_type == transaction_type)
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.join(models.Product).where(or_(models.Product.name.ilike(term), models.Product.sku.ilike(term),
                                                    models.StockTransaction.reference.ilike(term)))
    return [transaction_out(t) for t in db.scalars(stmt.limit(limit)).unique().all()]

@app.get("/api/dashboard", response_model=schemas.DashboardOut)
def dashboard(db: Session = Depends(get_db)):
    products = db.scalars(select(models.Product).options(joinedload(models.Product.supplier))).unique().all()
    low = [p for p in products if p.stock_quantity <= p.reorder_level]
    recent = db.scalars(select(models.StockTransaction).options(joinedload(models.StockTransaction.product))
                        .order_by(models.StockTransaction.created_at.desc()).limit(8)).unique().all()
    return schemas.DashboardOut(total_products=len(products),
        total_units=sum(p.stock_quantity for p in products),
        low_stock_count=len(low),
        inventory_value=round(sum(float(p.unit_price) * p.stock_quantity for p in products), 2),
        recent_transactions=[transaction_out(t) for t in recent],
        low_stock_products=[product_out(p) for p in low])

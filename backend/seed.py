from app.database import Base, engine, SessionLocal
from app import models

Base.metadata.create_all(bind=engine)
db = SessionLocal()
try:
    if db.query(models.Product).count() == 0:
        s1 = models.Supplier(name="Sri Traders", email="sales@sritraders.example", phone="9876543210", address="Hyderabad")
        s2 = models.Supplier(name="Metro Supplies", email="hello@metrosupplies.example", phone="9123456780", address="Secunderabad")
        db.add_all([s1, s2]); db.flush()
        db.add_all([
            models.Product(sku="ELEC-001", name="Wireless Mouse", category="Electronics", unit="pcs", unit_price=599, stock_quantity=32, reorder_level=10, supplier=s1),
            models.Product(sku="ELEC-002", name="USB Keyboard", category="Electronics", unit="pcs", unit_price=899, stock_quantity=7, reorder_level=10, supplier=s1),
            models.Product(sku="OFF-001", name="A4 Paper Ream", category="Stationery", unit="ream", unit_price=280, stock_quantity=50, reorder_level=15, supplier=s2),
            models.Product(sku="OFF-002", name="Blue Pen Pack", category="Stationery", unit="pack", unit_price=120, stock_quantity=4, reorder_level=8, supplier=s2),
        ])
        db.commit()
        print("Sample suppliers and products inserted.")
    else:
        print("Sample data already exists; no changes made.")
finally:
    db.close()

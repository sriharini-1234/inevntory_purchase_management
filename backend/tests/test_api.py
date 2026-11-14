import os
os.environ["DATABASE_URL"] = "sqlite:///./test_inventory.db"
from fastapi.testclient import TestClient
from app.database import Base, engine
from app.main import app

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
client = TestClient(app)

def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

def test_product_and_stock_flow():
    supplier = client.post("/api/suppliers", json={"name":"Test Supplier","email":"test@example.com"}).json()
    product = client.post("/api/products", json={"sku":"T-01","name":"Test Item","category":"Test",
        "unit":"pcs","unit_price":10,"stock_quantity":5,"reorder_level":2,"supplier_id":supplier["id"]})
    assert product.status_code == 201
    pid = product.json()["id"]
    issue = client.post("/api/stock/movements", json={"product_id":pid,"transaction_type":"ISSUE","quantity":3})
    assert issue.status_code == 201
    assert client.get("/api/products").json()[0]["stock_quantity"] == 2
    receipt = client.post("/api/stock/movements", json={"product_id":pid,"transaction_type":"RECEIPT","quantity":4})
    assert receipt.status_code == 201
    assert client.get("/api/products").json()[0]["stock_quantity"] == 6
    assert len(client.get("/api/transactions").json()) == 3

def test_prevent_negative_stock():
    p = client.post("/api/products", json={"sku":"T-02","name":"Low Item","unit_price":1,
        "stock_quantity":2,"reorder_level":1}).json()
    response = client.post("/api/stock/movements", json={"product_id":p["id"],"transaction_type":"ISSUE","quantity":3})
    assert response.status_code == 409
    assert client.get("/api/products").json()[0]["stock_quantity"] == 2

def test_duplicate_sku_rejected():
    payload = {"sku":"DUP","name":"One","unit_price":1,"stock_quantity":0,"reorder_level":0}
    assert client.post("/api/products", json=payload).status_code == 201
    assert client.post("/api/products", json={**payload, "name":"Two"}).status_code == 409

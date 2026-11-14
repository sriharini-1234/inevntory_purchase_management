from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class SupplierBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: Optional[str] = Field(default=None, max_length=160)
    phone: Optional[str] = Field(default=None, max_length=30)
    address: Optional[str] = Field(default=None, max_length=250)

class SupplierCreate(SupplierBase): pass
class SupplierOut(SupplierBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class ProductBase(BaseModel):
    sku: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=140)
    description: Optional[str] = Field(default=None, max_length=500)
    category: str = Field(default="General", max_length=80)
    unit: str = Field(default="pcs", max_length=20)
    unit_price: float = Field(default=0, ge=0)
    stock_quantity: int = Field(default=0, ge=0)
    reorder_level: int = Field(default=5, ge=0)
    supplier_id: Optional[int] = None

class ProductCreate(ProductBase): pass
class ProductUpdate(ProductBase): pass
class ProductOut(ProductBase):
    id: int
    supplier_name: Optional[str] = None
    low_stock: bool = False
    model_config = ConfigDict(from_attributes=True)

class StockMovementCreate(BaseModel):
    product_id: int
    transaction_type: str = Field(pattern="^(RECEIPT|ISSUE)$")
    quantity: int = Field(gt=0)
    unit_cost: Optional[float] = Field(default=None, ge=0)
    reference: Optional[str] = Field(default=None, max_length=80)
    notes: Optional[str] = Field(default=None, max_length=300)

class TransactionOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: str
    transaction_type: str
    quantity: int
    unit_cost: Optional[float]
    reference: Optional[str]
    notes: Optional[str]
    created_at: datetime

class DashboardOut(BaseModel):
    total_products: int
    total_units: int
    low_stock_count: int
    inventory_value: float
    recent_transactions: list[TransactionOut]
    low_stock_products: list[ProductOut]

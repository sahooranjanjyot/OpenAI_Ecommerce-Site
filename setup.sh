#!/usr/bin/env bash
set -e

BASE="$HOME/Desktop/OpenAI_Ecommerce-Site"
mkdir -p "$BASE/backend/app"

cat > "$BASE/backend/requirements.txt" <<'REQ'
fastapi
uvicorn
sqlalchemy
pydantic
REQ

cat > "$BASE/backend/app/database.py" <<'PY'
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./grocery.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
PY

cat > "$BASE/backend/app/models.py" <<'PY'
from sqlalchemy import Column, Integer, String, Float
from .database import Base

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    category = Column(String)
    price = Column(Float)
    quantity = Column(String)
    stock = Column(Integer, default=0)
    image_url = Column(String, default="")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String)
    mobile = Column(String)
    address = Column(String)
    slot = Column(String)
    payment_method = Column(String, default="COD")
    status = Column(String, default="NEW")
    total = Column(Float, default=0)
PY

cat > "$BASE/backend/app/schemas.py" <<'PY'
from pydantic import BaseModel

class ProductCreate(BaseModel):
    name: str
    category: str
    price: float
    quantity: str
    stock: int
    image_url: str = ""

class ProductOut(ProductCreate):
    id: int
    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    customer_name: str
    mobile: str
    address: str
    slot: str
    payment_method: str = "COD"
    total: float

class OrderOut(OrderCreate):
    id: int
    status: str
    class Config:
        from_attributes = True
PY

cat > "$BASE/backend/app/main.py" <<'PY'
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from .database import Base, engine, SessionLocal
from .models import Product, Order
from .schemas import ProductCreate, ProductOut, OrderCreate, OrderOut

app = FastAPI(title="Grocery Shop MVP")
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def home():
    return {"message": "Grocery Shop API running"}

@app.post("/products", response_model=ProductOut)
def add_product(payload: ProductCreate, db: Session = Depends(get_db)):
    item = Product(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.get("/products", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.query(Product).all()

@app.post("/orders", response_model=OrderOut)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    order = Order(**payload.model_dump())
    db.add(order)
    db.commit()
    db.refresh(order)
    return order

@app.get("/orders", response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db)):
    return db.query(Order).all()

@app.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    orders = db.query(Order).all()
    revenue = sum(o.total for o in orders)
    return {
        "orders_today": len(orders),
        "revenue_today": revenue,
        "top_products": []
    }
PY

chmod +x "$BASE/setup.sh"
echo "Project created successfully at $BASE"

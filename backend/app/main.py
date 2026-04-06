from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, SessionLocal, Base
from app.models import Product
from app.schemas import ProductResponse

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Grocery MVP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def seed_products():
    db = SessionLocal()
    if db.query(Product).count() == 0:
        sample_products = [
            Product(category="Fruits & vegetables", name="Bananas", price=1.20, unit_label="1 kg", stock_qty=50, in_stock=True),
            Product(category="Fruits & vegetables", name="Tomatoes", price=0.90, unit_label="500 g", stock_qty=40, in_stock=True),
            Product(category="Dairy", name="Milk", price=1.10, unit_label="1 litre", stock_qty=30, in_stock=True),
            Product(category="Snacks", name="Potato Chips", price=1.50, unit_label="1 pack", stock_qty=60, in_stock=True),
            Product(category="Beverages", name="Orange Juice", price=2.00, unit_label="1 litre", stock_qty=20, in_stock=True),
        ]
        db.add_all(sample_products)
        db.commit()
    db.close()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/v1/products", response_model=list[ProductResponse])
def list_products():
    db = SessionLocal()
    try:
        return db.query(Product).all()
    finally:
        db.close()

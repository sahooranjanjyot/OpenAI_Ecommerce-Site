from sqlalchemy import Column, Integer, String, Float, Boolean
from app.database import Base

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, index=True)
    name = Column(String, index=True)
    price = Column(Float)
    unit_label = Column(String)
    stock_qty = Column(Integer, default=0)
    in_stock = Column(Boolean, default=True)

class CartItem(Base):
    __tablename__ = "cart_items"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, index=True)
    product_name = Column(String)
    unit_price = Column(Float)
    quantity = Column(Integer, default=1)
    line_total = Column(Float)

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String)
    mobile = Column(String)
    address = Column(String)
    payment_method = Column(String, default="COD")
    total_amount = Column(Float)
    status = Column(String, default="New")

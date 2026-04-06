from pydantic import BaseModel

class ProductResponse(BaseModel):
    id: int
    category: str
    name: str
    price: float
    unit_label: str
    stock_qty: int
    in_stock: bool

    class Config:
        from_attributes = True

import os
import uuid
from typing import List

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from PIL import Image


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
PRODUCT_DIR = os.path.join(BASE_DIR, "products")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(PRODUCT_DIR, exist_ok=True)


app = FastAPI(title="Virtual Try-On Phase 1 API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")
app.mount("/products", StaticFiles(directory=PRODUCT_DIR), name="products")


class Product(BaseModel):
    id: int
    name: str
    image_name: str  
    price: float
    gender: str  

class CartItem(BaseModel):
    product_id: int
    quantity: int = 1


PRODUCTS_DB: List[Product] = [
    Product(id=1, name="Red Dress", image_name="dress1.png", price=1999.0, gender="female"),
    Product(id=2, name="Blue Dress", image_name="dress2.png", price=1799.0, gender="female"),
    Product(id=3, name="Casual Shirt", image_name="shirt1.png.jfif", price=1299.0, gender="male"),
    Product(id=4, name="Black T-Shirt", image_name="tshirt1.png", price=899.0, gender="unisex"),
]

CART: List[CartItem] = []


@app.get("/products", response_model=List[Product])
def get_products(gender: str | None = None):
    """
    Get product list. Optionally filter by gender.
    """
    if gender is None:
        return PRODUCTS_DB
    gender = gender.lower()
    return [p for p in PRODUCTS_DB if p.gender in (gender, "unisex")]


@app.get("/cart", response_model=List[CartItem])
def get_cart():
    return CART

@app.post("/cart/add", response_model=List[CartItem])
def add_to_cart(item: CartItem):
    
    product_ids = [p.id for p in PRODUCTS_DB]
    if item.product_id not in product_ids:
        return CART

    for cart_item in CART:
        if cart_item.product_id == item.product_id:
            cart_item.quantity += item.quantity
            break
    else:
        CART.append(item)
    return CART

@app.post("/cart/clear")
def clear_cart():
    CART.clear()
    return {"message": "Cart cleared"}


@app.post("/try-on")
async def try_on(
    person_photo: UploadFile = File(...),
    product_id: int = Form(...),
    gender: str = Form(...)
):
    """
    Phase 1: simple overlay.
    - Save uploaded person photo
    - Load product image
    - Resize and overlay product on person's upper body
    - Return URL of generated image
    """


    product = next((p for p in PRODUCTS_DB if p.id == product_id), None)
    if product is None:
        return {"error": "Product not found"}

    
    file_ext = os.path.splitext(person_photo.filename)[1] or ".png"
    person_filename = f"{uuid.uuid4()}{file_ext}"
    person_path = os.path.join(UPLOAD_DIR, person_filename)

    with open(person_path, "wb") as f:
        f.write(await person_photo.read())


    try:
        person_img = Image.open(person_path).convert("RGBA")
    except Exception:
        return {"error": "Invalid person image"}

    product_path = os.path.join(PRODUCT_DIR, product.image_name)
    if not os.path.exists(product_path):
        return {"error": "Product image file not found on server"}

    try:
        dress_img = Image.open(product_path).convert("RGBA")
    except Exception:
        return {"error": "Invalid product image"}

    pw, ph = person_img.size
    dw, dh = dress_img.size

    target_width = int(pw * 0.5)
    scale = target_width / dw
    target_height = int(dh * scale)
    dress_resized = dress_img.resize((target_width, target_height), Image.LANCZOS)

    x = pw // 2 - target_width // 2
    y = ph // 3

    result = person_img.copy()
    result.paste(dress_resized, (x, y), dress_resized)


    out_filename = f"{uuid.uuid4()}.png"
    out_path = os.path.join(OUTPUT_DIR, out_filename)
    result.save(out_path)

    try_on_url = f"/outputs/{out_filename}"

    return {
        "product_id": product_id,
        "gender": gender,
        "try_on_image_url": try_on_url
    }


@app.get("/")
def root():
    return {"message": "Virtual Try-On API - Phase 1 is running"}
